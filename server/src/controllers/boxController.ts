import { Request, Response } from 'express';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';

export const getBoxById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // Get box info
    const boxResult = await query(
      `SELECT b.*, r.room_id, r.room_name, r.room_admin
       FROM boxes b
       LEFT JOIN rooms r ON b.box_belong_room_id = r.room_id
       WHERE b.box_id = $1`,
      [id]
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
       WHERE i.item_current_box_id = $1
       ORDER BY i.item_create_time DESC`,
      [id]
    );

    return success(res, {
      ...box,
      items: itemsResult.rows,
    });
  } catch (err) {
    console.error('Get box error:', err);
    return error(res, 'Failed to get box', 500);
  }
};

export const getBoxes = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { roomId } = req.params;

    // Check if user is a member
    const memberCheck = await query(
      'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [roomId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return error(res, 'You are not a member of this room', 403);
    }

    const result = await query(
      `SELECT b.*,
        (SELECT COUNT(*) FROM items WHERE item_current_box_id = b.box_id) as item_count
       FROM boxes b
       WHERE b.box_belong_room_id = $1
       ORDER BY b.box_create_time ASC`,
      [roomId]
    );

    return success(res, result.rows);
  } catch (err) {
    console.error('Get boxes error:', err);
    return error(res, 'Failed to get boxes', 500);
  }
};

export const createBox = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { roomId } = req.params;
    const { name, qrcode, notice } = req.body;

    // Check if user is admin
    const roomCheck = await query(
      'SELECT room_admin FROM rooms WHERE room_id = $1',
      [roomId]
    );

    if (roomCheck.rows.length === 0) {
      return error(res, 'Room not found', 404);
    }

    if (roomCheck.rows[0].room_admin !== userId) {
      return error(res, 'Only admin can create boxes', 403);
    }

    // 名称必填
    if (!name || !name.trim()) {
      return error(res, '盒子名称不能为空', 400);
    }

    // 二维码必填
    if (!qrcode || !qrcode.trim()) {
      return error(res, '盒子二维码不能为空', 400);
    }

    // 二维码长度限制
    if (qrcode.length > 64) {
      return error(res, '二维码长度不能超过64个字符', 400);
    }

    // 检查二维码是否已存在
    const qrcodeCheck = await query(
      'SELECT box_id FROM boxes WHERE box_qrcode = $1',
      [qrcode]
    );

    if (qrcodeCheck.rows.length > 0) {
      return error(res, '该二维码已被使用', 400);
    }

    const createTime = Date.now();

    const result = await query(
      `INSERT INTO boxes (box_qrcode, box_name, box_belong_room_id, box_create_time, box_notice)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [qrcode, name, roomId, createTime, notice || null]
    );

    return success(res, result.rows[0], 'Box created', 201);
  } catch (err) {
    console.error('Create box error:', err);
    return error(res, 'Failed to create box', 500);
  }
};

export const updateBox = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { name, notice } = req.body;

    // Get box and check permission
    const boxCheck = await query(
      `SELECT b.box_belong_room_id, r.room_admin
       FROM boxes b
       JOIN rooms r ON b.box_belong_room_id = r.room_id
       WHERE b.box_id = $1`,
      [id]
    );

    if (boxCheck.rows.length === 0) {
      return error(res, 'Box not found', 404);
    }

    if (boxCheck.rows[0].room_admin !== userId) {
      return error(res, 'Only admin can update boxes', 403);
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`box_name = $${paramCount++}`);
      values.push(name);
    }

    if (notice !== undefined) {
      updates.push(`box_notice = $${paramCount++}`);
      values.push(notice);
    }

    if (updates.length === 0) {
      return error(res, 'No fields to update');
    }

    values.push(id);
    const result = await query(
      `UPDATE boxes SET ${updates.join(', ')} WHERE box_id = $${paramCount}
       RETURNING *`,
      values
    );

    return success(res, result.rows[0], 'Box updated');
  } catch (err) {
    console.error('Update box error:', err);
    return error(res, 'Failed to update box', 500);
  }
};

export const deleteBox = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { targetBoxId, toUserHand } = req.body;

    // Get box and check permission
    const boxCheck = await query(
      `SELECT b.box_belong_room_id, b.box_name, r.room_admin
       FROM boxes b
       JOIN rooms r ON b.box_belong_room_id = r.room_id
       WHERE b.box_id = $1`,
      [id]
    );

    if (boxCheck.rows.length === 0) {
      return error(res, 'Box not found', 404);
    }

    if (boxCheck.rows[0].room_admin !== userId) {
      return error(res, 'Only admin can delete boxes', 403);
    }

    const roomId = boxCheck.rows[0].box_belong_room_id;

    // Check if this is the last box in the room
    const boxCountCheck = await query(
      'SELECT COUNT(*) FROM boxes WHERE box_belong_room_id = $1',
      [roomId]
    );

    if (parseInt(boxCountCheck.rows[0].count) <= 1) {
      return error(res, '无法删除最后一个盒子', 400);
    }

    // Check if box has items
    const itemsCheck = await query(
      'SELECT COUNT(*) FROM items WHERE item_current_box_id = $1',
      [id]
    );

    const itemCount = parseInt(itemsCheck.rows[0].count);

    if (itemCount > 0) {
      // Need to specify where to move items
      if (!targetBoxId && !toUserHand) {
        return error(res, '请选择物品移动目标', 400);
      }

      if (toUserHand) {
        // Move items to user's personal box
        const userResult = await query(
          'SELECT user_box_id FROM users WHERE user_id = $1',
          [userId]
        );

        const userBoxId = userResult.rows[0]?.user_box_id;

        if (!userBoxId) {
          return error(res, '用户个人盒子不存在', 500);
        }

        // Get items before moving
        const itemsToMove = await query(
          'SELECT item_id FROM items WHERE item_current_box_id = $1',
          [id]
        );

        // Update items to user's personal box
        await query(
          'UPDATE items SET item_current_box_id = $1 WHERE item_current_box_id = $2',
          [userBoxId, id]
        );

        // Create history records for moved items
        const currentTime = Date.now();
        for (const item of itemsToMove.rows) {
          await query(
            `INSERT INTO histories (history_item_id, history_from_box_id, history_to_box_id, history_operator_id, history_time)
             VALUES ($1, $2, $3, $4, $5)`,
            [item.item_id, parseInt(id), userBoxId, userId, currentTime]
          );
        }
      } else if (targetBoxId) {
        // Validate target box is in the same room
        const targetBoxCheck = await query(
          'SELECT box_id FROM boxes WHERE box_id = $1 AND box_belong_room_id = $2',
          [targetBoxId, roomId]
        );

        if (targetBoxCheck.rows.length === 0) {
          return error(res, '目标盒子不存在或不属于该仓库', 400);
        }

        // Move items to target box
        await query(
          'UPDATE items SET item_current_box_id = $1 WHERE item_current_box_id = $2',
          [targetBoxId, id]
        );

        // Create history records for moved items
        const currentTime = Date.now();
        await query(
          `INSERT INTO histories (history_item_id, history_from_box_id, history_to_box_id, history_operator_id, history_time)
           SELECT item_id, $1, $2, $3, $4 FROM items WHERE item_current_box_id = $2`,
          [parseInt(id), targetBoxId, userId, currentTime]
        );
      }
    }

    await query('DELETE FROM boxes WHERE box_id = $1', [id]);

    return success(res, null, 'Box deleted');
  } catch (err) {
    console.error('Delete box error:', err);
    return error(res, 'Failed to delete box', 500);
  }
};
