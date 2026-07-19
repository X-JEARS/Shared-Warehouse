import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';
import { signAuthToken } from '../utils/jwt';
import {
  clearRefreshTokenCookie,
  issueRefreshToken,
  REFRESH_TOKEN_COOKIE,
  revokeRefreshToken,
  rotateRefreshToken,
  setRefreshTokenCookie,
} from '../utils/refreshToken';

export const register = async (req: Request, res: Response) => {
  try {
    const { loginName, password, nickname, tel } = req.body;

    // Validation
    if (!loginName || !password) {
      return error(res, 'Login name and password are required');
    }

    if (!/^[a-zA-Z0-9]{1,16}$/.test(loginName)) {
      return error(res, 'Login name must be 1-16 characters, letters and numbers only');
    }

    if (password.length < 6) {
      return error(res, 'Password must be at least 6 characters');
    }

    // Check if user exists
    const existingUser = await query(
      'SELECT user_id FROM users WHERE user_login_name = $1',
      [loginName]
    );

    if (existingUser.rows.length > 0) {
      return error(res, 'Login name already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create personal box for user
    const boxResult = await query(
      'INSERT INTO boxes (box_qrcode, box_create_time) VALUES ($1, $2) RETURNING box_id',
      [`userbox.${Date.now()}`, Date.now()]
    );
    const boxId = boxResult.rows[0].box_id;

    // Create user
    const createTime = Date.now();
    const result = await query(
      `INSERT INTO users (user_login_name, user_password, user_box_id, user_nickname, user_tel, user_create_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, user_login_name, user_nickname, user_avatar, user_create_time`,
      [loginName, hashedPassword, boxId, nickname || loginName, tel || null, createTime]
    );

    const user = result.rows[0];

    // Registration does not establish a long-lived session; the client directs
    // the user to log in after registration.
    const token = signAuthToken({
      userId: user.user_id,
      loginName: user.user_login_name,
      tokenVersion: 0,
    });

    return success(res, { user, token }, 'Registration successful', 201);
  } catch (err) {
    console.error('Register error:', err);
    return error(res, 'Registration failed', 500);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { loginName, password } = req.body;

    if (!loginName || !password) {
      return error(res, 'Login name and password are required');
    }

    // Find user
    const result = await query(
      'SELECT * FROM users WHERE user_login_name = $1',
      [loginName]
    );

    if (result.rows.length === 0) {
      return error(res, 'Invalid credentials', 401);
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.user_password);
    if (!isValid) {
      return error(res, 'Invalid credentials', 401);
    }

    // Generate token with version
    const token = signAuthToken({
      userId: user.user_id,
      loginName: user.user_login_name,
      tokenVersion: Number(user.token_version ?? 0),
    });
    const refreshToken = await issueRefreshToken(
      user.user_id,
      Number(user.token_version ?? 0)
    );
    setRefreshTokenCookie(res, refreshToken);

    // Remove password from response
    delete user.user_password;

    return success(res, { user, token }, 'Login successful');
  } catch (err) {
    console.error('Login error:', err);
    return error(res, 'Login failed', 500);
  }
};

export const refreshAccessToken = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (!refreshToken || typeof refreshToken !== 'string') {
    clearRefreshTokenCookie(res);
    return error(res, 'Refresh token is required', 401);
  }

  try {
    const rotated = await rotateRefreshToken(refreshToken);
    if (rotated.status === 'retry') {
      return error(res, 'Refresh token rotation is already in progress', 409);
    }
    if (rotated.status === 'invalid') {
      clearRefreshTokenCookie(res);
      return error(res, 'Refresh token is invalid or expired', 401);
    }

    const token = signAuthToken({
      userId: rotated.userId,
      loginName: rotated.loginName,
      tokenVersion: rotated.tokenVersion,
    });
    setRefreshTokenCookie(res, rotated.token);
    return success(res, { token }, 'Token refreshed');
  } catch (err) {
    console.error('Refresh token error:', err);
    clearRefreshTokenCookie(res);
    return error(res, 'Failed to refresh token', 500);
  }
};

export const logout = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

  try {
    if (refreshToken && typeof refreshToken === 'string') {
      await revokeRefreshToken(refreshToken);
    }
    clearRefreshTokenCookie(res);
    return success(res, null, 'Logged out');
  } catch (err) {
    console.error('Logout error:', err);
    clearRefreshTokenCookie(res);
    return error(res, 'Failed to log out', 500);
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const result = await query(
      `SELECT user_id, user_login_name, user_nickname, user_avatar, user_tel, user_create_time
       FROM users WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return error(res, 'User not found', 404);
    }

    return success(res, result.rows[0]);
  } catch (err) {
    console.error('Get me error:', err);
    return error(res, 'Failed to get user info', 500);
  }
};
