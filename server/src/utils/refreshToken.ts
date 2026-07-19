import { createHash, randomBytes, randomUUID } from 'crypto';
import { Response } from 'express';
import pool from '../config/database';

export const REFRESH_TOKEN_COOKIE = 'warehouse_refresh_token';
export const REFRESH_TOKEN_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
export const REFRESH_TOKEN_REUSE_GRACE_MS = 10 * 1000;

interface RefreshTokenRecord {
  refresh_token_user_id: number;
  refresh_token_family_id: string;
  refresh_token_version: number;
  refresh_token_expires_at: string | number;
  refresh_token_revoked_at: string | number | null;
  user_login_name: string;
  token_version: number;
}

interface RotatedRefreshToken {
  status: 'rotated';
  token: string;
  userId: number;
  loginName: string;
  tokenVersion: number;
}

export type RefreshTokenRotation =
  | RotatedRefreshToken
  | { status: 'retry' }
  | { status: 'invalid' };

const generateRefreshToken = (): string => randomBytes(32).toString('base64url');

const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: REFRESH_TOKEN_IDLE_MS,
});

export const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_TOKEN_COOKIE, token, getCookieOptions());
};

export const clearRefreshTokenCookie = (res: Response) => {
  const { maxAge: _maxAge, ...options } = getCookieOptions();
  res.clearCookie(REFRESH_TOKEN_COOKIE, options);
};

export const issueRefreshToken = async (
  userId: number,
  tokenVersion: number
): Promise<string> => {
  const token = generateRefreshToken();
  const now = Date.now();

  await pool.query(
    'DELETE FROM refresh_tokens WHERE refresh_token_expires_at < $1',
    [now]
  );
  await pool.query(
    `INSERT INTO refresh_tokens (
       refresh_token_user_id, refresh_token_hash, refresh_token_family_id,
       refresh_token_version, refresh_token_expires_at,
       refresh_token_created_at, refresh_token_last_used_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [
      userId,
      hashRefreshToken(token),
      randomUUID(),
      tokenVersion,
      now + REFRESH_TOKEN_IDLE_MS,
      now,
    ]
  );

  return token;
};

export const rotateRefreshToken = async (
  token: string
): Promise<RefreshTokenRotation> => {
  const client = await pool.connect();
  const tokenHash = hashRefreshToken(token);
  const now = Date.now();

  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM refresh_tokens WHERE refresh_token_expires_at < $1',
      [now]
    );
    const result = await client.query<RefreshTokenRecord>(
      `SELECT rt.*, u.user_login_name, u.token_version
       FROM refresh_tokens rt
       JOIN users u ON u.user_id = rt.refresh_token_user_id
       WHERE rt.refresh_token_hash = $1
       FOR UPDATE OF rt`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return { status: 'invalid' };
    }

    const record = result.rows[0];
    const currentVersion = Number(record.token_version);
    const isInvalid =
      Number(record.refresh_token_expires_at) <= now ||
      Number(record.refresh_token_version) !== currentVersion;

    if (record.refresh_token_revoked_at !== null) {
      if (now - Number(record.refresh_token_revoked_at) <= REFRESH_TOKEN_REUSE_GRACE_MS) {
        await client.query('ROLLBACK');
        return { status: 'retry' };
      }

      await client.query(
        `UPDATE refresh_tokens
         SET refresh_token_revoked_at = COALESCE(refresh_token_revoked_at, $1)
         WHERE refresh_token_family_id = $2`,
        [now, record.refresh_token_family_id]
      );
      await client.query('COMMIT');
      return { status: 'invalid' };
    }

    if (isInvalid) {
      await client.query(
        `UPDATE refresh_tokens
         SET refresh_token_revoked_at = COALESCE(refresh_token_revoked_at, $1)
         WHERE refresh_token_family_id = $2`,
        [now, record.refresh_token_family_id]
      );
      await client.query('COMMIT');
      return { status: 'invalid' };
    }

    const nextToken = generateRefreshToken();
    const nextTokenHash = hashRefreshToken(nextToken);
    await client.query(
      `UPDATE refresh_tokens
       SET refresh_token_revoked_at = $1,
           refresh_token_last_used_at = $1,
           refresh_token_replaced_by_hash = $2
       WHERE refresh_token_hash = $3`,
      [now, nextTokenHash, tokenHash]
    );
    await client.query(
      `INSERT INTO refresh_tokens (
         refresh_token_user_id, refresh_token_hash, refresh_token_family_id,
         refresh_token_version, refresh_token_expires_at,
         refresh_token_created_at, refresh_token_last_used_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [
        record.refresh_token_user_id,
        nextTokenHash,
        record.refresh_token_family_id,
        currentVersion,
        now + REFRESH_TOKEN_IDLE_MS,
        now,
      ]
    );
    await client.query('COMMIT');

    return {
      status: 'rotated',
      token: nextToken,
      userId: record.refresh_token_user_id,
      loginName: record.user_login_name,
      tokenVersion: currentVersion,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const revokeRefreshToken = async (token: string): Promise<void> => {
  const now = Date.now();
  await pool.query(
    `UPDATE refresh_tokens
     SET refresh_token_revoked_at = COALESCE(refresh_token_revoked_at, $1)
     WHERE refresh_token_family_id = (
       SELECT refresh_token_family_id
       FROM refresh_tokens
       WHERE refresh_token_hash = $2
       LIMIT 1
     )`,
    [now, hashRefreshToken(token)]
  );
};

export const revokeUserRefreshTokens = async (userId: number): Promise<void> => {
  await pool.query(
    `UPDATE refresh_tokens
     SET refresh_token_revoked_at = COALESCE(refresh_token_revoked_at, $1)
     WHERE refresh_token_user_id = $2`,
    [Date.now(), userId]
  );
};
