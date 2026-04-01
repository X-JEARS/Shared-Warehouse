import { Request, Response } from 'express';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';

export const getRooms = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await query(
      `SELECT r.*, rm.member_name,
        (SELECT COUNT(*) FROM items i
         JOIN boxes b ON i.item_current_box_id = b.box_id
         WHERE b.box_belong_room_id = r.room_id) as item_count
       FROM rooms r
       JOIN room_members rm ON r.room_id = rm.member_room_id
       WHERE rm.member_user_id = $1
       ORDER BY r.room_create_time DESC`,
      [userId]
    );

    return success(res, result.rows);
  } catch (err) {
    console.error('Get rooms error:', err);
    return error(res, 'Failed to get rooms', 500);
  }
};

export const getRoomById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // Check if user is a member
    const memberCheck = await query(
      'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return error(res, 'You are not a member of this room', 403);
    }

    const result = await query(
      `SELECT r.*, u.user_nickname as admin_nickname
       FROM rooms r
       JOIN users u ON r.room_admin = u.user_id
       WHERE r.room_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return error(res, 'Room not found', 404);
    }

    const room = result.rows[0];
    room.isAdmin = room.room_admin === userId;

    return success(res, room);
  } catch (err) {
    console.error('Get room error:', err);
    return error(res, 'Failed to get room', 500);
  }
};

export const createRoom = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { name, notice } = req.body;

    if (!name) {
      return error(res, 'Room name is required');
    }

    if (name.length > 24) {
      return error(res, 'Room name must be 24 characters or less');
    }

    const createTime = Date.now();

    // Create room
    const roomResult = await query(
      `INSERT INTO rooms (room_name, room_admin, room_create_time, room_notice)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, userId, createTime, notice || null]
    );

    const room = roomResult.rows[0];

    // Add creator as member
    await query(
      `INSERT INTO room_members (member_user_id, member_room_id, member_join_time)
       VALUES ($1, $2, $3)`,
      [userId, room.room_id, createTime]
    );

    // Create a default box for the room
    const defaultBoxQrcode = `box.${room.room_id}.default`;
    await query(
      `INSERT INTO boxes (box_qrcode, box_name, box_belong_room_id, box_create_time)
       VALUES ($1, $2, $3, $4)`,
      [defaultBoxQrcode, '默认盒子', room.room_id, createTime]
    );

    return success(res, room, 'Room created', 201);
  } catch (err) {
    console.error('Create room error:', err);
    return error(res, 'Failed to create room', 500);
  }
};

export const updateRoom = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { name, notice } = req.body;

    // Check if user is admin
    const roomCheck = await query(
      'SELECT room_admin FROM rooms WHERE room_id = $1',
      [id]
    );

    if (roomCheck.rows.length === 0) {
      return error(res, 'Room not found', 404);
    }

    if (roomCheck.rows[0].room_admin !== userId) {
      return error(res, 'Only admin can update room', 403);
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`room_name = $${paramCount++}`);
      values.push(name);
    }

    if (notice !== undefined) {
      updates.push(`room_notice = $${paramCount++}`);
      values.push(notice);
    }

    if (updates.length === 0) {
      return error(res, 'No fields to update');
    }

    values.push(id);
    const result = await query(
      `UPDATE rooms SET ${updates.join(', ')} WHERE room_id = $${paramCount}
       RETURNING *`,
      values
    );

    return success(res, result.rows[0], 'Room updated');
  } catch (err) {
    console.error('Update room error:', err);
    return error(res, 'Failed to update room', 500);
  }
};

export const joinRoom = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { memberName } = req.body;

    // Check if room exists
    const roomCheck = await query(
      'SELECT * FROM rooms WHERE room_id = $1',
      [id]
    );

    if (roomCheck.rows.length === 0) {
      return error(res, 'Room not found', 404);
    }

    // Check if already a member
    const memberCheck = await query(
      'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [id, userId]
    );

    if (memberCheck.rows.length > 0) {
      return error(res, 'Already a member of this room');
    }

    const joinTime = Date.now();
    await query(
      `INSERT INTO room_members (member_user_id, member_room_id, member_name, member_join_time)
       VALUES ($1, $2, $3, $4)`,
      [userId, id, memberName || null, joinTime]
    );

    return success(res, null, 'Joined room successfully');
  } catch (err) {
    console.error('Join room error:', err);
    return error(res, 'Failed to join room', 500);
  }
};

export const getMembers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // Check if user is a member
    const memberCheck = await query(
      'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return error(res, 'You are not a member of this room', 403);
    }

    const result = await query(
      `SELECT rm.*, u.user_login_name, u.user_nickname, u.user_avatar
       FROM room_members rm
       JOIN users u ON rm.member_user_id = u.user_id
       WHERE rm.member_room_id = $1
       ORDER BY rm.member_join_time ASC`,
      [id]
    );

    return success(res, result.rows);
  } catch (err) {
    console.error('Get members error:', err);
    return error(res, 'Failed to get members', 500);
  }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id, memberId } = req.params;

    // Check if user is admin
    const roomCheck = await query(
      'SELECT room_admin FROM rooms WHERE room_id = $1',
      [id]
    );

    if (roomCheck.rows.length === 0) {
      return error(res, 'Room not found', 404);
    }

    if (roomCheck.rows[0].room_admin !== userId) {
      return error(res, 'Only admin can remove members', 403);
    }

    // Cannot remove admin
    if (parseInt(memberId) === roomCheck.rows[0].room_admin) {
      return error(res, 'Cannot remove admin from room');
    }

    await query(
      'DELETE FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [id, memberId]
    );

    return success(res, null, 'Member removed');
  } catch (err) {
    console.error('Remove member error:', err);
    return error(res, 'Failed to remove member', 500);
  }
};
