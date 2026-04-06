import { Router } from 'express';
import { uploadAvatar, uploadItemImage } from '../controllers/uploadController';
import { auth } from '../middlewares/auth';

const router = Router();

router.post('/avatar', auth, ...uploadAvatar);
router.post('/items/:id/image', auth, ...uploadItemImage);

export default router;
