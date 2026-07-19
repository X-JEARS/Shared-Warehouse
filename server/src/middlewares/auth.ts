import { Request, Response, NextFunction } from 'express';
import { error } from '../utils/response';
import { query } from '../config/database';
import {
  JwtPayload,
  verifyAuthToken,
} from '../utils/jwt';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

const getActiveTokenVersion = async (userId: number): Promise<number | null> => {
  const userResult = await query(
    'SELECT token_version FROM users WHERE user_id = $1',
    [userId]
  );
  return userResult.rows.length > 0
    ? Number(userResult.rows[0].token_version)
    : null;
};

export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAuthToken(token);
    const activeTokenVersion = await getActiveTokenVersion(decoded.userId);

    if (activeTokenVersion === null || activeTokenVersion !== (decoded.tokenVersion ?? 0)) {
      return error(res, 'Token has been revoked', 401);
    }

    req.user = decoded;

    next();
  } catch (err) {
    return error(res, 'Invalid or expired token', 401);
  }
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAuthToken(token);
      const activeTokenVersion = await getActiveTokenVersion(decoded.userId);
      if (activeTokenVersion === null || activeTokenVersion !== (decoded.tokenVersion ?? 0)) {
        return error(res, 'Token has been revoked', 401);
      }
      req.user = decoded;
    }

    next();
  } catch {
    next();
  }
};
