import jwt, { SignOptions } from 'jsonwebtoken';

export interface JwtPayload {
  userId: number;
  loginName: string;
  tokenVersion?: number;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};

export const assertJwtConfigured = (): void => {
  getJwtSecret();
};

export const signAuthToken = (payload: JwtPayload): string => {
  const signOptions: SignOptions = {
    expiresIn: (process.env.ACCESS_TOKEN_EXPIRES_IN || '15m') as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, getJwtSecret(), signOptions);
};

export const verifyAuthToken = (token: string): JwtPayload =>
  jwt.verify(token, getJwtSecret()) as JwtPayload;
