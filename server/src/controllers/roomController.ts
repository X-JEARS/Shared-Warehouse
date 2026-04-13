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

// Request to join a room (requires admin approval)
export const requestJoinRoom = async (req: AuthRequest, res: Response) => {
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

    // Check if already has a pending request
    const requestCheck = await query(
      "SELECT * FROM room_join_requests WHERE request_room_id = $1 AND request_user_id = $2 AND request_status = 'pending'",
      [id, userId]
    );

    if (requestCheck.rows.length > 0) {
      return error(res, 'You already have a pending request for this room');
    }

    // Delete any previous rejected/approved requests for this user-room combo
    await query(
      'DELETE FROM room_join_requests WHERE request_room_id = $1 AND request_user_id = $2',
      [id, userId]
    );

    // Create join request
    const createTime = Date.now();
    await query(
      `INSERT INTO room_join_requests (request_user_id, request_room_id, request_member_name, request_status, request_create_time)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [userId, id, memberName || null, createTime]
    );

    return success(res, null, 'Join request submitted, waiting for admin approval');
  } catch (err) {
    console.error('Request join room error:', err);
    return error(res, 'Failed to request join room', 500);
  }
};

// Get join requests for a room (admin only)
export const getJoinRequests = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // Check if user is admin
    const roomCheck = await query(
      'SELECT room_admin FROM rooms WHERE room_id = $1',
      [id]
    );

    if (roomCheck.rows.length === 0) {
      return error(res, 'Room not found', 404);
    }

    if (roomCheck.rows[0].room_admin !== userId) {
      return error(res, 'Only admin can view join requests', 403);
    }

    const result = await query(
      `SELECT r.*, u.user_login_name, u.user_nickname, u.user_avatar
       FROM room_join_requests r
       JOIN users u ON r.request_user_id = u.user_id
       WHERE r.request_room_id = $1 AND r.request_status = 'pending'
       ORDER BY r.request_create_time ASC`,
      [id]
    );

    return success(res, result.rows);
  } catch (err) {
    console.error('Get join requests error:', err);
    return error(res, 'Failed to get join requests', 500);
  }
};

// Approve join request (admin only)
export const approveJoinRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id, requestId } = req.params;

    // Check if user is admin
    const roomCheck = await query(
      'SELECT room_admin FROM rooms WHERE room_id = $1',
      [id]
    );

    if (roomCheck.rows.length === 0) {
      return error(res, 'Room not found', 404);
    }

    if (roomCheck.rows[0].room_admin !== userId) {
      return error(res, 'Only admin can approve requests', 403);
    }

    // Get the request
    const requestCheck = await query(
      'SELECT * FROM room_join_requests WHERE request_id = $1 AND request_room_id = $2',
      [requestId, id]
    );

    if (requestCheck.rows.length === 0) {
      return error(res, 'Request not found', 404);
    }

    const request = requestCheck.rows[0];

    if (request.request_status !== 'pending') {
      return error(res, 'Request already processed', 400);
    }

    // Check if user is already a member
    const memberCheck = await query(
      'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [id, request.request_user_id]
    );

    if (memberCheck.rows.length > 0) {
      // Update request status and return
      await query(
        "UPDATE room_join_requests SET request_status = 'approved', request_process_time = $1 WHERE request_id = $2",
        [Date.now(), requestId]
      );
      return error(res, 'User is already a member of this room');
    }

    const processTime = Date.now();

    // Add user as member
    await query(
      `INSERT INTO room_members (member_user_id, member_room_id, member_name, member_join_time)
       VALUES ($1, $2, $3, $4)`,
      [request.request_user_id, id, request.request_member_name, processTime]
    );

    // Update request status
    await query(
      "UPDATE room_join_requests SET request_status = 'approved', request_process_time = $1 WHERE request_id = $2",
      [processTime, requestId]
    );

    return success(res, null, 'Join request approved');
  } catch (err) {
    console.error('Approve join request error:', err);
    return error(res, 'Failed to approve join request', 500);
  }
};

// Reject join request (admin only)
export const rejectJoinRequest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id, requestId } = req.params;

    // Check if user is admin
    const roomCheck = await query(
      'SELECT room_admin FROM rooms WHERE room_id = $1',
      [id]
    );

    if (roomCheck.rows.length === 0) {
      return error(res, 'Room not found', 404);
    }

    if (roomCheck.rows[0].room_admin !== userId) {
      return error(res, 'Only admin can reject requests', 403);
    }

    // Get the request
    const requestCheck = await query(
      'SELECT * FROM room_join_requests WHERE request_id = $1 AND request_room_id = $2',
      [requestId, id]
    );

    if (requestCheck.rows.length === 0) {
      return error(res, 'Request not found', 404);
    }

    const request = requestCheck.rows[0];

    if (request.request_status !== 'pending') {
      return error(res, 'Request already processed', 400);
    }

    // Update request status
    await query(
      "UPDATE room_join_requests SET request_status = 'rejected', request_process_time = $1 WHERE request_id = $2",
      [Date.now(), requestId]
    );

    return success(res, null, 'Join request rejected');
  } catch (err) {
    console.error('Reject join request error:', err);
    return error(res, 'Failed to reject join request', 500);
  }
};

// Check user's join request status
export const getJoinRequestStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM room_join_requests
       WHERE request_room_id = $1 AND request_user_id = $2
       ORDER BY request_create_time DESC
       LIMIT 1`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return success(res, null);
    }

    return success(res, result.rows[0]);
  } catch (err) {
    console.error('Get join request status error:', err);
    return error(res, 'Failed to get join request status', 500);
  }
};
