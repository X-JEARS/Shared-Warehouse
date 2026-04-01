import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { nickname, avatar, tel } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (nickname !== undefined) {
      if (nickname.length > 16) {
        return error(res, 'Nickname must be 16 characters or less');
      }
      updates.push(`user_nickname = $${paramCount++}`);
      values.push(nickname);
    }

    if (avatar !== undefined) {
      updates.push(`user_avatar = $${paramCount++}`);
      values.push(avatar);
    }

    if (tel !== undefined) {
      updates.push(`user_tel = $${paramCount++}`);
      values.push(tel);
    }

    if (updates.length === 0) {
      return error(res, 'No fields to update');
    }

    values.push(userId);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramCount}
       RETURNING user_id, user_login_name, user_nickname, user_avatar, user_tel, user_create_time`,
      values
    );

    return success(res, result.rows[0], 'Profile updated');
  } catch (err) {
    console.error('Update profile error:', err);
    return error(res, 'Failed to update profile', 500);
  }
};

export const updatePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return error(res, 'Current password and new password are required');
    }

    if (newPassword.length < 6) {
      return error(res, 'New password must be at least 6 characters');
    }

    // Get current user
    const userResult = await query(
      'SELECT user_password FROM users WHERE user_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return error(res, 'User not found', 404);
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].user_password);
    if (!isValid) {
      return error(res, 'Current password is incorrect', 401);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await query(
      'UPDATE users SET user_password = $1 WHERE user_id = $2',
      [hashedPassword, userId]
    );

    return success(res, null, 'Password updated');
  } catch (err) {
    console.error('Update password error:', err);
    return error(res, 'Failed to update password', 500);
  }
};
