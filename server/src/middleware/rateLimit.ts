import rateLimit from 'express-rate-limit';
import { error } from '../utils/response';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 failed attempts per window
  skipSuccessfulRequests: true,
  handler: (_req, res) => error(res, 'Too many attempts, please try again later', 429),
  standardHeaders: true,
  legacyHeaders: false,
});
