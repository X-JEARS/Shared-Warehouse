import { Request, Response } from 'express';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { page = 1, pageSize = 20 } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);

    const result = await query(
      `SELECT * FROM notifications
       WHERE notification_user_id = $1
       ORDER BY notification_create_time DESC
       LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM notifications WHERE notification_user_id = $1',
      [userId]
    );

    const unreadResult = await query(
      'SELECT COUNT(*) FROM notifications WHERE notification_user_id = $1 AND notification_is_read = false',
      [userId]
    );

    return success(res, {
      items: result.rows,
      total: parseInt(countResult.rows[0].count),
      unreadCount: parseInt(unreadResult.rows[0].count),
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    return error(res, 'Failed to get notifications', 500);
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const result = await query(
      'UPDATE notifications SET notification_is_read = true WHERE notification_id = $1 AND notification_user_id = $2',
      [id, userId]
    );

    if (result.rowCount === 0) {
      return error(res, 'Notification not found', 404);
    }

    return success(res, null, 'Marked as read');
  } catch (err) {
    console.error('Mark as read error:', err);
    return error(res, 'Failed to mark as read', 500);
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    await query(
      'UPDATE notifications SET notification_is_read = true WHERE notification_user_id = $1 AND notification_is_read = false',
      [userId]
    );

    return success(res, null, 'All notifications marked as read');
  } catch (err) {
    console.error('Mark all as read error:', err);
    return error(res, 'Failed to mark all as read', 500);
  }
};
