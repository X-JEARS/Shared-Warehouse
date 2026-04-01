import { Router } from 'express';
import { getCart, addToCart, removeFromCart, checkout, clearCart } from '../controllers/cartController';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/', auth, getCart);
router.post('/', auth, addToCart);
router.delete('/:itemId', auth, removeFromCart);
router.post('/checkout', auth, checkout);
router.delete('/', auth, clearCart);

export default router;
