import { Request, Response } from 'express';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';
import { getRoomAdminUserIds } from '../utils/admin';
import { createNotification } from './notificationController';

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

export const borrowItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { itemId } = req.body;

    if (!itemId) {
      return error(res, 'Item ID is required');
    }

    // Get item
    const itemResult = await query(
      `SELECT i.*, b.box_belong_room_id
       FROM items i
       JOIN boxes b ON i.item_current_box_id = b.box_id
       WHERE i.item_id = $1`,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return error(res, 'Item not found', 404);
    }

    const item = itemResult.rows[0];

    // Get user's personal box
    const userResult = await query(
      'SELECT user_box_id FROM users WHERE user_id = $1',
      [userId]
    );

    const userBoxId = userResult.rows[0].user_box_id;

    // Move item to user's personal box
    await query(
      'UPDATE items SET item_current_box_id = $1 WHERE item_id = $2',
      [userBoxId, itemId]
    );

    // Record history
    await query(
      `INSERT INTO histories (history_item_id, history_user_id, history_box_id, history_time)
       VALUES ($1, $2, $3, $4)`,
      [itemId, userId, userBoxId, Date.now()]
    );

    // Notify item owner if borrower is not the owner
    if (item.item_belong_user_id !== userId) {
      const borrowerResult = await query(
        'SELECT user_nickname FROM users WHERE user_id = $1',
        [userId]
      );
      const borrowerName = borrowerResult.rows[0]?.user_nickname || '未知用户';
      await query(
        `INSERT INTO notifications (notification_user_id, notification_type, notification_title, notification_content, notification_related_id, notification_create_time)
         VALUES ($1, 'borrow', $2, $3, $4, $5)`,
        [item.item_belong_user_id, '物品被取走', `${borrowerName} 取走了 ${item.item_name}`, itemId, Date.now()]
      );
    }

    return success(res, null, 'Item borrowed successfully');
  } catch (err) {
    console.error('Borrow item error:', err);
    return error(res, 'Failed to borrow item', 500);
  }
};

export const borrowItemsBatch = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { itemIds } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return error(res, 'Item IDs array is required');
    }

    // Get user's personal box
    const userResult = await query(
      'SELECT user_box_id, user_nickname FROM users WHERE user_id = $1',
      [userId]
    );
    const userBoxId = userResult.rows[0]?.user_box_id;
    const borrowerName = userResult.rows[0]?.user_nickname || '未知用户';

    if (!userBoxId) {
      return error(res, 'User personal box not found');
    }

    const results: Array<{ itemId: number; success: boolean; message: string }> = [];
    let totalSucceeded = 0;
    let totalFailed = 0;

    for (const itemId of itemIds) {
      try {
        const itemResult = await query(
          `SELECT i.*, b.box_belong_room_id
           FROM items i
           JOIN boxes b ON i.item_current_box_id = b.box_id
           WHERE i.item_id = $1`,
          [itemId]
        );

        if (itemResult.rows.length === 0) {
          results.push({ itemId, success: false, message: '物品不存在' });
          totalFailed++;
          continue;
        }

        const item = itemResult.rows[0];

        // Skip items already in user's hand
        if (item.item_current_box_id === userBoxId) {
          results.push({ itemId, success: true, message: '物品已在手中' });
          totalSucceeded++;
          continue;
        }

        // Move item to user's personal box
        await query(
          'UPDATE items SET item_current_box_id = $1 WHERE item_id = $2',
          [userBoxId, itemId]
        );

        // Record history
        await query(
          `INSERT INTO histories (history_item_id, history_user_id, history_box_id, history_time)
           VALUES ($1, $2, $3, $4)`,
          [itemId, userId, userBoxId, Date.now()]
        );

        // Notify item owner if borrower is not the owner
        if (item.item_belong_user_id !== userId) {
          await query(
            `INSERT INTO notifications (notification_user_id, notification_type, notification_title, notification_content, notification_related_id, notification_create_time)
             VALUES ($1, 'borrow', $2, $3, $4, $5)`,
            [item.item_belong_user_id, '物品被取走', `${borrowerName} 取走了 ${item.item_name}`, itemId, Date.now()]
          );
        }

        results.push({ itemId, success: true, message: '取走成功' });
        totalSucceeded++;
      } catch (err) {
        console.error(`Borrow item ${itemId} error:`, err);
        results.push({ itemId, success: false, message: '取走失败' });
        totalFailed++;
      }
    }

    return success(res, { results, totalSucceeded, totalFailed });
  } catch (err) {
    console.error('Borrow items batch error:', err);
    return error(res, 'Failed to borrow items batch', 500);
  }
};

export const returnItemsBatch = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return error(res, 'Items array is required');
    }

    const returnerResult = await query(
      'SELECT user_nickname FROM users WHERE user_id = $1',
      [userId]
    );
    const returnerName = returnerResult.rows[0]?.user_nickname || '未知用户';

    const results: Array<{ itemId: number; success: boolean; message: string }> = [];
    let totalSucceeded = 0;
    let totalFailed = 0;

    for (const { itemId, boxId } of items) {
      try {
        if (!itemId || !boxId) {
          results.push({ itemId: itemId || 0, success: false, message: '缺少 itemId 或 boxId' });
          totalFailed++;
          continue;
        }

        const itemResult = await query(
          'SELECT * FROM items WHERE item_id = $1',
          [itemId]
        );

        if (itemResult.rows.length === 0) {
          results.push({ itemId, success: false, message: '物品不存在' });
          totalFailed++;
          continue;
        }

        const item = itemResult.rows[0];

        // Verify target box exists
        const boxCheck = await query(
          `SELECT b.*, r.room_id, r.room_admin, r.room_name
           FROM boxes b
           LEFT JOIN rooms r ON b.box_belong_room_id = r.room_id
           WHERE b.box_id = $1`,
          [boxId]
        );

        if (boxCheck.rows.length === 0) {
          results.push({ itemId, success: false, message: '目标盒子不存在' });
          totalFailed++;
          continue;
        }

        const targetBox = boxCheck.rows[0];

        // Move item to target box
        await query(
          'UPDATE items SET item_current_box_id = $1 WHERE item_id = $2',
          [boxId, itemId]
        );

        // Record history
        await query(
          `INSERT INTO histories (history_item_id, history_user_id, history_box_id, history_time)
           VALUES ($1, $2, $3, $4)`,
          [itemId, userId, boxId, Date.now()]
        );

        const createTime = Date.now();

        // Notify item owner if returner is not the owner
        if (item.item_belong_user_id !== userId) {
          await createNotification(
            item.item_belong_user_id,
            'return',
            '物品被放入',
            `${returnerName} 将 ${item.item_name} 放入了 ${targetBox.box_name}`,
            itemId
          );
        }

        // Notify all room admins (excluding operator and item owner to avoid duplicates)
        if (targetBox.room_id) {
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
        }

        results.push({ itemId, success: true, message: '放入成功' });
        totalSucceeded++;
      } catch (err) {
        console.error(`Return item ${itemId} error:`, err);
        results.push({ itemId, success: false, message: '放入失败' });
        totalFailed++;
      }
    }

    return success(res, { results, totalSucceeded, totalFailed });
  } catch (err) {
    console.error('Return items batch error:', err);
    return error(res, 'Failed to return items batch', 500);
  }
};

export const returnItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { itemId, boxId } = req.body;

    if (!itemId || !boxId) {
      return error(res, 'Item ID and box ID are required');
    }

    // Get item
    const itemResult = await query(
      'SELECT * FROM items WHERE item_id = $1',
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return error(res, 'Item not found', 404);
    }

    const item = itemResult.rows[0];

    // Verify target box exists and user has access
    const boxCheck = await query(
      `SELECT b.*, r.room_id, r.room_admin, r.room_name
       FROM boxes b
       LEFT JOIN rooms r ON b.box_belong_room_id = r.room_id
       WHERE b.box_id = $1`,
      [boxId]
    );

    if (boxCheck.rows.length === 0) {
      return error(res, 'Target box not found');
    }

    const targetBox = boxCheck.rows[0];

    // Move item to target box
    await query(
      'UPDATE items SET item_current_box_id = $1 WHERE item_id = $2',
      [boxId, itemId]
    );

    // Record history
    await query(
      `INSERT INTO histories (history_item_id, history_user_id, history_box_id, history_time)
       VALUES ($1, $2, $3, $4)`,
      [itemId, userId, boxId, Date.now()]
    );

    const createTime = Date.now();
    const returnerResult = await query(
      'SELECT user_nickname FROM users WHERE user_id = $1',
      [userId]
    );
    const returnerName = returnerResult.rows[0]?.user_nickname || '未知用户';

    // Notify item owner if returner is not the owner
    if (item.item_belong_user_id !== userId) {
      await createNotification(
        item.item_belong_user_id,
        'return',
        '物品被放入',
        `${returnerName} 将 ${item.item_name} 放入了 ${targetBox.box_name}`,
        itemId
      );
    }

    // Notify all room admins (excluding operator and item owner to avoid duplicates)
    if (targetBox.room_id) {
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
    }

    return success(res, null, 'Item returned successfully');
  } catch (err) {
    console.error('Return item error:', err);
    return error(res, 'Failed to return item', 500);
  }
};
