import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { error } from '../utils/response';
import { query } from '../config/database';

export interface JwtPayload {
  userId: number;
  loginName: string;
  tokenVersion?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};

const isTokenActive = async (decoded: JwtPayload): Promise<boolean> => {
  const userResult = await query(
    'SELECT token_version FROM users WHERE user_id = $1',
    [decoded.userId]
  );
  const tokenVersion = decoded.tokenVersion ?? 0;
  return userResult.rows.length > 0 && userResult.rows[0].token_version === tokenVersion;
};

export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = getJwtSecret();

    const decoded = jwt.verify(token, secret) as JwtPayload;

    if (!await isTokenActive(decoded)) {
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
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret) as JwtPayload;
      if (!await isTokenActive(decoded)) {
        return error(res, 'Token has been revoked', 401);
      }
      req.user = decoded;
    }

    next();
  } catch {
    next();
  }
};
