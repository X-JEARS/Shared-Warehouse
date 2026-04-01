import { Request, Response } from 'express';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';

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

      // Check access
      if (box.room_id) {
        const memberCheck = await query(
          'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
          [box.room_id, userId]
        );

        if (memberCheck.rows.length === 0) {
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
      `SELECT i.*, b.box_name, b.box_belong_room_id, r.room_id, r.room_name
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

    // Check access
    if (item.room_id) {
      const memberCheck = await query(
        'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
        [item.room_id, userId]
      );

      if (memberCheck.rows.length === 0) {
        return error(res, 'Access denied', 403);
      }
    }

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

    // Create notification for owner
    if (item.item_belong_user_id !== userId) {
      await query(
        `INSERT INTO notifications (notification_user_id, notification_type, notification_title, notification_related_id, notification_create_time)
         VALUES ($1, 'borrow', $2, $3, $4)`,
        [item.item_belong_user_id, 'Item borrowed', itemId, Date.now()]
      );
    }

    return success(res, null, 'Item borrowed successfully');
  } catch (err) {
    console.error('Borrow item error:', err);
    return error(res, 'Failed to borrow item', 500);
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

    // Get user's personal box
    const userResult = await query(
      'SELECT user_box_id FROM users WHERE user_id = $1',
      [userId]
    );

    const userBoxId = userResult.rows[0].user_box_id;

    // Check if user has this item
    if (item.item_current_box_id !== userBoxId) {
      return error(res, 'You do not have this item');
    }

    // Verify target box exists and user has access
    const boxCheck = await query(
      `SELECT b.*, r.room_id
       FROM boxes b
       LEFT JOIN rooms r ON b.box_belong_room_id = r.room_id
       WHERE b.box_id = $1`,
      [boxId]
    );

    if (boxCheck.rows.length === 0) {
      return error(res, 'Target box not found');
    }

    const targetBox = boxCheck.rows[0];

    // Check access to target room
    if (targetBox.room_id) {
      const memberCheck = await query(
        'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
        [targetBox.room_id, userId]
      );

      if (memberCheck.rows.length === 0) {
        return error(res, 'Access denied to target box');
      }
    }

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

    // Create notification for owner
    if (item.item_belong_user_id !== userId) {
      await query(
        `INSERT INTO notifications (notification_user_id, notification_type, notification_title, notification_related_id, notification_create_time)
         VALUES ($1, 'return', $2, $3, $4)`,
        [item.item_belong_user_id, 'Item returned', itemId, Date.now()]
      );
    }

    return success(res, null, 'Item returned successfully');
  } catch (err) {
    console.error('Return item error:', err);
    return error(res, 'Failed to return item', 500);
  }
};
