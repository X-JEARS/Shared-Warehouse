import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { error } from '../utils/response';

export interface JwtPayload {
  userId: number;
  loginName: string;
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

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = getJwtSecret();

    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;

    next();
  } catch (err) {
    return error(res, 'Invalid or expired token', 401);
  }
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret) as JwtPayload;
      req.user = decoded;
    }

    next();
  } catch {
    next();
  }
};
