import { Request, Response } from 'express';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';
import { isRoomAdmin, isPrimaryAdmin } from '../utils/admin';
import { createNotification } from './notificationController';

export const getRooms = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await query(
      `SELECT r.*, rm.member_name,
        (SELECT COUNT(*) FROM items i
         JOIN boxes b ON i.item_current_box_id = b.box_id
         WHERE b.box_belong_room_id = r.room_id) as item_count,
        (r.room_admin = $1 OR EXISTS (
           SELECT 1 FROM room_admins ra
           WHERE ra.admin_room_id = r.room_id AND ra.admin_user_id = $1
         )) as is_admin
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
      `SELECT r.*, u.user_nickname as admin_nickname,
        (r.room_admin = $2 OR EXISTS (
           SELECT 1 FROM room_admins ra
           WHERE ra.admin_room_id = r.room_id AND ra.admin_user_id = $2
         )) as is_admin
       FROM rooms r
       JOIN users u ON r.room_admin = u.user_id
       WHERE r.room_id = $1`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return error(res, 'Room not found', 404);
    }

    const room = result.rows[0];
    room.isAdmin = !!room.is_admin;

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
    const roomId = parseInt(id);

    if (!(await isRoomAdmin(roomId, userId))) {
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
      `SELECT rm.*, u.user_login_name, u.user_nickname, u.user_avatar,
        (r.room_admin = rm.member_user_id OR ra.admin_user_id IS NOT NULL) AS is_admin
       FROM room_members rm
       JOIN users u ON rm.member_user_id = u.user_id
       JOIN rooms r ON rm.member_room_id = r.room_id
       LEFT JOIN room_admins ra
         ON ra.admin_room_id = rm.member_room_id AND ra.admin_user_id = rm.member_user_id
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
    const roomId = parseInt(id);
    const targetUserId = parseInt(memberId);

    if (!(await isRoomAdmin(roomId, userId))) {
      return error(res, 'Only admin can remove members', 403);
    }

    // Cannot remove the primary admin
    if (await isPrimaryAdmin(roomId, targetUserId)) {
      return error(res, 'Cannot remove admin from room');
    }

    // Removing another admin requires primary admin
    const targetIsAdmin = await isRoomAdmin(roomId, targetUserId);
    if (targetIsAdmin && !(await isPrimaryAdmin(roomId, userId))) {
      return error(res, 'Only primary admin can remove other admins', 403);
    }

    // Remove membership and any admin role for this user in this room
    await query(
      `DELETE FROM room_members WHERE member_room_id = $1 AND member_user_id = $2`,
      [id, memberId]
    );
    await query(
      `DELETE FROM room_admins WHERE admin_room_id = $1 AND admin_user_id = $2`,
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
    const roomId = parseInt(id);

    if (!(await isRoomAdmin(roomId, userId))) {
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
    const roomId = parseInt(id);

    if (!(await isRoomAdmin(roomId, userId))) {
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
    const roomId = parseInt(id);

    if (!(await isRoomAdmin(roomId, userId))) {
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

// Add a secondary admin (primary admin only)
export const addAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { userId: targetUserId } = req.body;
    const roomId = parseInt(id);
    const target = parseInt(targetUserId);

    if (!target) {
      return error(res, 'userId is required');
    }

    if (!(await isPrimaryAdmin(roomId, userId))) {
      return error(res, 'Only primary admin can add admins', 403);
    }

    if (target === userId) {
      return error(res, 'You are already the primary admin');
    }

    // Target must be a member of the room
    const memberCheck = await query(
      'SELECT 1 FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [id, target]
    );
    if (memberCheck.rows.length === 0) {
      return error(res, 'Target user is not a member of this room');
    }

    // Target must not already be primary or secondary admin
    if (await isPrimaryAdmin(roomId, target)) {
      return error(res, 'User is already an admin');
    }
    const existing = await query(
      'SELECT 1 FROM room_admins WHERE admin_room_id = $1 AND admin_user_id = $2',
      [id, target]
    );
    if (existing.rows.length > 0) {
      return error(res, 'User is already an admin');
    }

    const roomResult = await query(
      'SELECT room_name FROM rooms WHERE room_id = $1',
      [id]
    );
    const roomName = roomResult.rows[0]?.room_name || '';

    await query(
      `INSERT INTO room_admins (admin_user_id, admin_room_id, admin_add_time)
       VALUES ($1, $2, $3)`,
      [target, id, Date.now()]
    );

    // Notify the new admin
    const operatorResult = await query(
      'SELECT user_nickname FROM users WHERE user_id = $1',
      [userId]
    );
    const operatorName = operatorResult.rows[0]?.user_nickname || '管理员';
    await createNotification(
      target,
      'admin',
      '成为管理员',
      `${operatorName} 将你设为了 ${roomName} 的管理员`,
      roomId
    );

    return success(res, null, 'Admin added');
  } catch (err) {
    console.error('Add admin error:', err);
    return error(res, 'Failed to add admin', 500);
  }
};

// Remove a secondary admin (primary admin only)
export const removeAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id, userId: targetUserId } = req.params;
    const roomId = parseInt(id);
    const target = parseInt(targetUserId);

    if (!(await isPrimaryAdmin(roomId, userId))) {
      return error(res, 'Only primary admin can remove admins', 403);
    }

    if (await isPrimaryAdmin(roomId, target)) {
      return error(res, 'Cannot remove the primary admin');
    }

    const result = await query(
      'DELETE FROM room_admins WHERE admin_room_id = $1 AND admin_user_id = $2 RETURNING *',
      [id, target]
    );

    if (result.rows.length === 0) {
      return error(res, 'User is not an admin of this room', 404);
    }

    return success(res, null, 'Admin removed');
  } catch (err) {
    console.error('Remove admin error:', err);
    return error(res, 'Failed to remove admin', 500);
  }
};

// Transfer primary admin to another member (primary admin only).
// Old primary becomes a normal admin; new primary is removed from room_admins (if present).
export const transferPrimaryAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { userId: targetUserId } = req.body;
    const roomId = parseInt(id);
    const target = parseInt(targetUserId);

    if (!target) {
      return error(res, 'userId is required');
    }

    if (!(await isPrimaryAdmin(roomId, userId))) {
      return error(res, 'Only primary admin can transfer ownership', 403);
    }

    if (target === userId) {
      return error(res, 'You are already the primary admin');
    }

    // Target must be a member
    const memberCheck = await query(
      'SELECT 1 FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [id, target]
    );
    if (memberCheck.rows.length === 0) {
      return error(res, 'Target user is not a member of this room');
    }

    // Promote old primary to normal admin (ignore if already present)
    await query(
      `INSERT INTO room_admins (admin_user_id, admin_room_id, admin_add_time)
       VALUES ($1, $2, $3)
       ON CONFLICT (admin_user_id, admin_room_id) DO NOTHING`,
      [userId, id, Date.now()]
    );

    // Hand over primary ownership (ON CONFLICT is impossible since target != old primary,
    // and primary constraint uniqueness is across the table only as a single value)
    await query(
      'UPDATE rooms SET room_admin = $1 WHERE room_id = $2',
      [target, id]
    );

    // Remove new primary from room_admins (cannot be both primary and secondary)
    await query(
      'DELETE FROM room_admins WHERE admin_room_id = $1 AND admin_user_id = $2',
      [id, target]
    );

    // Fetch names + room name for notifications
    const namesResult = await query(
      `SELECT
        (SELECT user_nickname FROM users WHERE user_id = $1) AS old_name,
        (SELECT user_nickname FROM users WHERE user_id = $2) AS new_name,
        (SELECT room_name FROM rooms WHERE room_id = $3) AS room_name`,
      [userId, target, id]
    );
    const oldName = namesResult.rows[0]?.old_name || '我';
    const newName = namesResult.rows[0]?.new_name || '';
    const roomName = namesResult.rows[0]?.room_name || '';

    // Notify new primary and old primary
    await createNotification(
      target,
      'admin',
      '成为主管理员',
      `${oldName} 已将 ${roomName} 的主管理员转让给你`,
      roomId ?? null
    );
    await createNotification(
      userId!,
      'admin',
      '已转让主管理员',
      `你已将 ${roomName} 的主管理员转让给 ${newName}`,
      roomId ?? null
    );

    return success(res, null, 'Primary admin transferred');
  } catch (err) {
    console.error('Transfer primary admin error:', err);
    return error(res, 'Failed to transfer primary admin', 500);
  }
};
