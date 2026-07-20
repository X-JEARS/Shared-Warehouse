import { Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import pool, { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';
import { TRANSFER_IMAGE_EXTENSIONS } from '../middlewares/transferImageUpload';
import { getRoomAdminUserIds } from '../utils/admin';
import { createNotification } from './notificationController';

enum TransferRecordType {
  Borrow = 1,
  Return = 2,
}

interface BatchItemResult {
  itemId: number;
  success: boolean;
  message: string;
}

interface BatchOutcome {
  results: BatchItemResult[];
  totalSucceeded: number;
  totalFailed: number;
  transferRecordId: number | null;
  transferRecordImage: string | null;
}

class ScanOperationError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

const parseArrayField = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const summarizeResults = (
  results: BatchItemResult[],
  transferRecordId: number | null,
  transferRecordImage: string | null
): BatchOutcome => ({
  results,
  totalSucceeded: results.filter((result) => result.success).length,
  totalFailed: results.filter((result) => !result.success).length,
  transferRecordId,
  transferRecordImage,
});

const removeFileIfPresent = async (filePath: string | null) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      console.error('Clean up transfer image error:', err);
    }
  }
};

const saveTransferImage = async (transferRecordId: number, file: Express.Multer.File) => {
  const extension = TRANSFER_IMAGE_EXTENSIONS[file.mimetype];
  if (!extension) {
    throw new ScanOperationError('Invalid transfer image type');
  }

  const uploadDir = path.join(__dirname, '../../public/transfer-images');
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `${transferRecordId}.${extension}`;
  const absolutePath = path.join(uploadDir, filename);
  await fs.writeFile(absolutePath, file.buffer);

  return {
    absolutePath,
    publicPath: `/transfer-images/${filename}`,
  };
};

export const scanQrcode = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { qrcode } = req.body;

    if (!qrcode) {
      return error(res, 'QR code is required');
    }

    // Check if it's a box QR code
    if (qrcode.startsWith('box.')) {
      const boxResult = await query(
        `SELECT b.*, r.room_id, r.room_name, r.room_admin
         FROM boxes b
         LEFT JOIN rooms r ON b.box_belong_room_id = r.room_id
         WHERE b.box_qrcode = $1`,
        [qrcode]
      );

      if (boxResult.rows.length === 0) {
        return error(res, 'Box not found', 404);
      }

      const box = boxResult.rows[0];

      // Authorization: verify user is a member of the room this box belongs to
      if (box.box_belong_room_id) {
        const memberCheck = await query(
          'SELECT 1 FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
          [box.box_belong_room_id, userId]
        );
        if (memberCheck.rows.length === 0) {
          return error(res, 'Access denied', 403);
        }
      } else {
        const ownerCheck = await query(
          'SELECT 1 FROM users WHERE user_box_id = $1 AND user_id = $2',
          [box.box_id, userId]
        );
        if (ownerCheck.rows.length === 0) {
          return error(res, 'Access denied', 403);
        }
      }

      // Get items in this box
      const itemsResult = await query(
        `SELECT i.*, u.user_nickname as owner_nickname
         FROM items i
         LEFT JOIN users u ON i.item_belong_user_id = u.user_id
         WHERE i.item_current_box_id = $1`,
        [box.box_id]
      );

      return success(res, {
        type: 'box',
        box,
        items: itemsResult.rows,
      });
    }

    // Check if it's an item QR code
    const itemResult = await query(
      `SELECT i.*, b.box_name, b.box_belong_room_id, r.room_id, r.room_name,
        CASE WHEN b.box_belong_room_id IS NULL THEN
          (SELECT u3.user_nickname FROM users u3 WHERE u3.user_box_id = b.box_id)
        ELSE r.room_name END as display_location_name
       FROM items i
       JOIN boxes b ON i.item_current_box_id = b.box_id
       LEFT JOIN rooms r ON b.box_belong_room_id = r.room_id
       WHERE i.item_qrcode = $1`,
      [qrcode]
    );

    if (itemResult.rows.length === 0) {
      return error(res, 'Item not found', 404);
    }

    const item = itemResult.rows[0];

    item.isOwner = item.item_belong_user_id === userId;

    // Check if item is in current user's personal box
    const userResult = await query(
      'SELECT user_box_id FROM users WHERE user_id = $1',
      [userId]
    );
    const userBoxId = userResult.rows[0]?.user_box_id;
    item.isInHand = item.item_current_box_id === userBoxId;

    // Get current holder (if item is in a user's personal box)
    if (item.box_belong_room_id === null) {
      const holderResult = await query(
        `SELECT u.user_id, u.user_nickname
         FROM users u
         WHERE u.user_box_id = $1`,
        [item.item_current_box_id]
      );
      if (holderResult.rows.length > 0) {
        item.currentHolder = holderResult.rows[0];
      }
    }

    return success(res, {
      type: 'item',
      item,
    });
  } catch (err) {
    console.error('Scan error:', err);
    return error(res, 'Failed to scan QR code', 500);
  }
};

const processBorrowItems = async (
  userId: number,
  itemIds: unknown[],
  image?: Express.Multer.File
): Promise<BatchOutcome> => {
  const client = await pool.connect();
  const results: BatchItemResult[] = [];
  const candidates: Array<{ itemId: number; item: any }> = [];
  const seenItemIds = new Set<number>();
  let imageAbsolutePath: string | null = null;
  let transferRecordId: number | null = null;
  let transferRecordImage: string | null = null;
  let borrowerName = '未知用户';

  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      'SELECT user_box_id, user_nickname FROM users WHERE user_id = $1',
      [userId]
    );
    const userBoxId = userResult.rows[0]?.user_box_id;
    borrowerName = userResult.rows[0]?.user_nickname || borrowerName;
    if (!userBoxId) {
      throw new ScanOperationError('User personal box not found');
    }

    for (const rawItemId of itemIds) {
      const itemId = Number(rawItemId);
      if (!Number.isInteger(itemId) || itemId <= 0) {
        results.push({ itemId: 0, success: false, message: '无效的物品 ID' });
        continue;
      }
      if (seenItemIds.has(itemId)) {
        results.push({ itemId, success: false, message: '物品重复' });
        continue;
      }
      seenItemIds.add(itemId);

      const itemResult = await client.query(
        `SELECT i.*, b.box_belong_room_id
         FROM items i
         JOIN boxes b ON i.item_current_box_id = b.box_id
         WHERE i.item_id = $1
         FOR UPDATE OF i`,
        [itemId]
      );
      if (itemResult.rows.length === 0) {
        results.push({ itemId, success: false, message: '物品不存在' });
        continue;
      }

      const item = itemResult.rows[0];
      if (item.item_current_box_id === userBoxId) {
        results.push({ itemId, success: true, message: '物品已在手中' });
        continue;
      }

      // Authorization: verify user is a member of the room containing the item
      if (item.box_belong_room_id) {
        const memberCheck = await client.query(
          'SELECT 1 FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
          [item.box_belong_room_id, userId]
        );
        if (memberCheck.rows.length === 0) {
          results.push({ itemId, success: false, message: '您不是该仓库的成员' });
          continue;
        }
      }

      results.push({ itemId, success: true, message: '取走成功' });
      candidates.push({ itemId, item });
    }

    if (candidates.length > 0) {
      const transferTime = Date.now();
      const recordResult = await client.query(
        `INSERT INTO transfer_records
           (transfer_record_user_id, transfer_record_type, transfer_record_time)
         VALUES ($1, $2, $3)
         RETURNING transfer_record_id`,
        [userId, TransferRecordType.Borrow, transferTime]
      );
      const createdRecordId = Number(recordResult.rows[0].transfer_record_id);
      transferRecordId = createdRecordId;

      for (const candidate of candidates) {
        await client.query(
          'UPDATE items SET item_current_box_id = $1 WHERE item_id = $2',
          [userBoxId, candidate.itemId]
        );
        await client.query(
          `INSERT INTO histories
             (history_item_id, history_user_id, history_box_id, history_time, history_transfer_record_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [candidate.itemId, userId, userBoxId, transferTime, createdRecordId]
        );
      }

      if (image) {
        const savedImage = await saveTransferImage(createdRecordId, image);
        imageAbsolutePath = savedImage.absolutePath;
        transferRecordImage = savedImage.publicPath;
        await client.query(
          'UPDATE transfer_records SET transfer_record_image = $1 WHERE transfer_record_id = $2',
          [transferRecordImage, createdRecordId]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    await removeFileIfPresent(imageAbsolutePath);
    throw err;
  } finally {
    client.release();
  }

  for (const candidate of candidates) {
    if (candidate.item.item_belong_user_id !== userId) {
      await createNotification(
        candidate.item.item_belong_user_id,
        'borrow',
        '物品被取走',
        `${borrowerName} 取走了 ${candidate.item.item_name}`,
        candidate.itemId
      );
    }
  }

  return summarizeResults(results, transferRecordId, transferRecordImage);
};

const sendReturnNotifications = async (userId: number, returnerName: string, candidates: any[]) => {
  for (const candidate of candidates) {
    const { item, itemId, targetBox } = candidate;
    if (item.item_belong_user_id !== userId) {
      await createNotification(
        item.item_belong_user_id,
        'return',
        '物品被放入',
        `${returnerName} 将 ${item.item_name} 放入了 ${targetBox.box_name}`,
        itemId
      );
    }

    if (!targetBox.room_id) continue;
    try {
      const adminIds = await getRoomAdminUserIds(targetBox.room_id);
      for (const adminId of adminIds) {
        if (adminId === userId || adminId === item.item_belong_user_id) continue;
        await createNotification(
          adminId,
          'return',
          '物品被放入',
          `${returnerName} 将 ${item.item_name} 放入了 ${targetBox.box_name}（${targetBox.room_name}）`,
          itemId
        );
      }
    } catch (err) {
      console.error('Send return admin notifications error:', err);
    }
  }
};

const processReturnItems = async (
  userId: number,
  items: unknown[],
  image?: Express.Multer.File
): Promise<BatchOutcome> => {
  const client = await pool.connect();
  const results: BatchItemResult[] = [];
  const candidates: Array<{ itemId: number; boxId: number; item: any; targetBox: any }> = [];
  const seenItemIds = new Set<number>();
  let imageAbsolutePath: string | null = null;
  let transferRecordId: number | null = null;
  let transferRecordImage: string | null = null;
  let returnerName = '未知用户';

  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      'SELECT user_nickname FROM users WHERE user_id = $1',
      [userId]
    );
    returnerName = userResult.rows[0]?.user_nickname || returnerName;

    for (const rawItem of items) {
      const value = rawItem && typeof rawItem === 'object' ? rawItem as any : {};
      const itemId = Number(value.itemId);
      const boxId = Number(value.boxId);
      if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isInteger(boxId) || boxId <= 0) {
        results.push({ itemId: Number.isInteger(itemId) ? itemId : 0, success: false, message: '缺少 itemId 或 boxId' });
        continue;
      }
      if (seenItemIds.has(itemId)) {
        results.push({ itemId, success: false, message: '物品重复' });
        continue;
      }
      seenItemIds.add(itemId);

      const itemResult = await client.query(
        'SELECT * FROM items WHERE item_id = $1 FOR UPDATE',
        [itemId]
      );
      if (itemResult.rows.length === 0) {
        results.push({ itemId, success: false, message: '物品不存在' });
        continue;
      }

      const boxResult = await client.query(
        `SELECT b.*, r.room_id, r.room_admin, r.room_name
         FROM boxes b
         LEFT JOIN rooms r ON b.box_belong_room_id = r.room_id
         WHERE b.box_id = $1`,
        [boxId]
      );
      if (boxResult.rows.length === 0) {
        results.push({ itemId, success: false, message: '目标盒子不存在' });
        continue;
      }

      const targetBox = boxResult.rows[0];
      if (targetBox.box_belong_room_id) {
        const memberCheck = await client.query(
          'SELECT 1 FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
          [targetBox.box_belong_room_id, userId]
        );
        if (memberCheck.rows.length === 0) {
          results.push({ itemId, success: false, message: '您不是目标仓库的成员' });
          continue;
        }
      } else {
        const ownerCheck = await client.query(
          'SELECT 1 FROM users WHERE user_box_id = $1 AND user_id = $2',
          [boxId, userId]
        );
        if (ownerCheck.rows.length === 0) {
          results.push({ itemId, success: false, message: '无权访问目标盒子' });
          continue;
        }
      }

      results.push({ itemId, success: true, message: '放入成功' });
      candidates.push({ itemId, boxId, item: itemResult.rows[0], targetBox });
    }

    if (candidates.length > 0) {
      const transferTime = Date.now();
      const recordResult = await client.query(
        `INSERT INTO transfer_records
           (transfer_record_user_id, transfer_record_type, transfer_record_time)
         VALUES ($1, $2, $3)
         RETURNING transfer_record_id`,
        [userId, TransferRecordType.Return, transferTime]
      );
      const createdRecordId = Number(recordResult.rows[0].transfer_record_id);
      transferRecordId = createdRecordId;

      for (const candidate of candidates) {
        await client.query(
          'UPDATE items SET item_current_box_id = $1 WHERE item_id = $2',
          [candidate.boxId, candidate.itemId]
        );
        await client.query(
          `INSERT INTO histories
             (history_item_id, history_user_id, history_box_id, history_time, history_transfer_record_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [candidate.itemId, userId, candidate.boxId, transferTime, createdRecordId]
        );
      }

      if (image) {
        const savedImage = await saveTransferImage(createdRecordId, image);
        imageAbsolutePath = savedImage.absolutePath;
        transferRecordImage = savedImage.publicPath;
        await client.query(
          'UPDATE transfer_records SET transfer_record_image = $1 WHERE transfer_record_id = $2',
          [transferRecordImage, createdRecordId]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    await removeFileIfPresent(imageAbsolutePath);
    throw err;
  } finally {
    client.release();
  }

  await sendReturnNotifications(userId, returnerName, candidates);
  return summarizeResults(results, transferRecordId, transferRecordImage);
};

const handleScanError = (res: Response, err: unknown, fallbackMessage: string) => {
  console.error(fallbackMessage, err);
  if (err instanceof ScanOperationError) {
    return error(res, err.message, err.statusCode);
  }
  return error(res, fallbackMessage, 500);
};

export const borrowItem = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const itemId = Number(req.body.itemId);
  if (!userId) return error(res, 'Unauthorized', 401);
  if (!Number.isInteger(itemId) || itemId <= 0) return error(res, 'Item ID is required');

  try {
    const outcome = await processBorrowItems(userId, [itemId]);
    const itemResult = outcome.results[0];
    if (!itemResult.success) {
      return error(res, itemResult.message, itemResult.message === '物品不存在' ? 404 : 400);
    }
    return success(res, {
      transferRecordId: outcome.transferRecordId,
    }, 'Item borrowed successfully');
  } catch (err) {
    return handleScanError(res, err, 'Failed to borrow item');
  }
};

export const borrowItemsBatch = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const itemIds = parseArrayField(req.body.itemIds);
  if (!userId) return error(res, 'Unauthorized', 401);
  if (!itemIds || itemIds.length === 0) return error(res, 'Item IDs array is required');
  if (itemIds.length > 50) return error(res, 'Too many items: maximum 50 per batch');

  try {
    const outcome = await processBorrowItems(userId, itemIds, req.file);
    return success(res, outcome);
  } catch (err) {
    return handleScanError(res, err, 'Failed to borrow items batch');
  }
};

export const returnItem = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const itemId = Number(req.body.itemId);
  const boxId = Number(req.body.boxId);
  if (!userId) return error(res, 'Unauthorized', 401);
  if (!Number.isInteger(itemId) || !Number.isInteger(boxId) || itemId <= 0 || boxId <= 0) {
    return error(res, 'Item ID and box ID are required');
  }

  try {
    const outcome = await processReturnItems(userId, [{ itemId, boxId }]);
    const itemResult = outcome.results[0];
    if (!itemResult.success) {
      return error(res, itemResult.message, itemResult.message === '物品不存在' ? 404 : 400);
    }
    return success(res, {
      transferRecordId: outcome.transferRecordId,
    }, 'Item returned successfully');
  } catch (err) {
    return handleScanError(res, err, 'Failed to return item');
  }
};

export const returnItemsBatch = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const items = parseArrayField(req.body.items);
  if (!userId) return error(res, 'Unauthorized', 401);
  if (!items || items.length === 0) return error(res, 'Items array is required');
  if (items.length > 50) return error(res, 'Too many items: maximum 50 per batch');

  try {
    const outcome = await processReturnItems(userId, items, req.file);
    return success(res, outcome);
  } catch (err) {
    return handleScanError(res, err, 'Failed to return items batch');
  }
};
