import { Router } from 'express';
import {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  joinRoom,
  getMembers,
  removeMember,
  requestJoinRoom,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  getJoinRequestStatus,
  addAdmin,
  removeAdmin,
  transferPrimaryAdmin,
} from '../controllers/roomController';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/', auth, getRooms);
router.get('/:id', auth, getRoomById);
router.post('/', auth, createRoom);
router.put('/:id', auth, updateRoom);
router.post('/:id/join', auth, joinRoom);
router.post('/:id/request-join', auth, requestJoinRoom);
router.get('/:id/join-requests', auth, getJoinRequests);
router.get('/:id/join-request-status', auth, getJoinRequestStatus);
router.post('/:id/join-requests/:requestId/approve', auth, approveJoinRequest);
router.post('/:id/join-requests/:requestId/reject', auth, rejectJoinRequest);
router.get('/:id/members', auth, getMembers);
router.delete('/:id/members/:memberId', auth, removeMember);
router.post('/:id/admins', auth, addAdmin);
router.delete('/:id/admins/:userId', auth, removeAdmin);
router.post('/:id/transfer-admin', auth, transferPrimaryAdmin);

export default router;
