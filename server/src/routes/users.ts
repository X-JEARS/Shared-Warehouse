import { Router } from 'express';
import { updateProfile, updatePassword } from '../controllers/userController';
import { auth } from '../middlewares/auth';

const router = Router();

router.put('/profile', auth, updateProfile);
router.put('/password', auth, updatePassword);

export default router;
