import { Router } from 'express';
import { uploadAvatar } from '../controllers/uploadController';
import { auth } from '../middlewares/auth';

const router = Router();

router.post('/avatar', auth, ...uploadAvatar);

export default router;
