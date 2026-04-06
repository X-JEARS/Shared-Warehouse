import { Router } from 'express';
import {
  getReservations,
  createReservation,
  cancelReservation,
  getItemReservations,
  createOrder,
  getOrders,
  getRoomOrders,
  getOrderDetail,
  cancelOrder,
  getTags,
  createTag,
  deleteTag,
  checkConflicts,
} from '../controllers/reservationController';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/', auth, getReservations);
router.post('/', auth, createReservation);
router.post('/check-conflicts', auth, checkConflicts);
router.delete('/:id', auth, cancelReservation);

router.get('/orders', auth, getOrders);
router.post('/orders', auth, createOrder);
router.get('/orders/:id', auth, getOrderDetail);
router.delete('/orders/:id', auth, cancelOrder);

router.get('/items/:id', auth, getItemReservations);

router.get('/rooms/:roomId/orders', auth, getRoomOrders);
router.get('/rooms/:roomId/tags', auth, getTags);
router.post('/rooms/:roomId/tags', auth, createTag);
router.delete('/tags/:id', auth, deleteTag);

export default router;
