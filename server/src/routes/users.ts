import { Router } from 'express';
import { updateProfile, updatePassword, searchUsers } from '../controllers/userController';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/search', auth, searchUsers);
router.put('/profile', auth, updateProfile);
router.put('/password', auth, updatePassword);

export default router;
