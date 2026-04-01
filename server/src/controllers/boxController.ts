import { Request, Response } from 'express';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';

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
    const { name, notice } = req.body;

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

    const createTime = Date.now();
    const qrcode = `box.${roomId}.${Date.now()}`;

    const result = await query(
      `INSERT INTO boxes (box_qrcode, box_name, box_belong_room_id, box_create_time, box_notice)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [qrcode, name || null, roomId, createTime, notice || null]
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
      return error(res, 'Only admin can delete boxes', 403);
    }

    // Check if box has items
    const itemsCheck = await query(
      'SELECT COUNT(*) FROM items WHERE item_current_box_id = $1',
      [id]
    );

    if (parseInt(itemsCheck.rows[0].count) > 0) {
      return error(res, 'Cannot delete box with items. Move items first.');
    }

    await query('DELETE FROM boxes WHERE box_id = $1', [id]);

    return success(res, null, 'Box deleted');
  } catch (err) {
    console.error('Delete box error:', err);
    return error(res, 'Failed to delete box', 500);
  }
};
