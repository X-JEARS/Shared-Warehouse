import { query } from '../config/database';

// True if user is the primary admin (rooms.room_admin) OR an additional admin (room_admins)
export async function isRoomAdmin(roomId: number | undefined, userId: number | undefined): Promise<boolean> {
  if (!userId || !roomId) return false;
  const result = await query(
    `SELECT 1 FROM rooms r
     WHERE r.room_id = $1 AND r.room_admin = $2
     UNION ALL
     SELECT 1 FROM room_admins
     WHERE admin_room_id = $1 AND admin_user_id = $2`,
    [roomId, userId]
  );
  return result.rows.length > 0;
}

// True only if user is the primary admin (rooms.room_admin)
export async function isPrimaryAdmin(roomId: number | undefined, userId: number | undefined): Promise<boolean> {
  if (!userId || !roomId) return false;
  const result = await query(
    'SELECT room_admin FROM rooms WHERE room_id = $1',
    [roomId]
  );
  return result.rows.length > 0 && result.rows[0].room_admin === userId;
}

// Return user ids of all admins (primary + additional) for a room
export async function getRoomAdminUserIds(roomId: number | undefined): Promise<number[]> {
  if (!roomId) return [];
  const result = await query(
    `SELECT room_admin AS user_id FROM rooms WHERE room_id = $1
     UNION
     SELECT admin_user_id AS user_id FROM room_admins WHERE admin_room_id = $1`,
    [roomId]
  );
  return result.rows.map((r: any) => r.user_id);
}