import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController';
import { auth } from '../middlewares/auth';
import { authRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.get('/me', auth, getMe);

export default router;
