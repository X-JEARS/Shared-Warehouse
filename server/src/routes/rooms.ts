import { Router } from 'express';
import {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  joinRoom,
  getMembers,
  removeMember,
} from '../controllers/roomController';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/', auth, getRooms);
router.get('/:id', auth, getRoomById);
router.post('/', auth, createRoom);
router.put('/:id', auth, updateRoom);
router.post('/:id/join', auth, joinRoom);
router.get('/:id/members', auth, getMembers);
router.delete('/:id/members/:memberId', auth, removeMember);

export default router;
