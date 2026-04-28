import { Router } from 'express';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../controllers/notificationController';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/unread-count', auth, getUnreadCount);
router.get('/', auth, getNotifications);
router.put('/:id/read', auth, markAsRead);
router.put('/read-all', auth, markAllAsRead);

export default router;
