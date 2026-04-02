import { Router } from 'express';
import { getBoxes, getBoxById, createBox, updateBox, deleteBox } from '../controllers/boxController';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/room/:roomId', auth, getBoxes);
router.get('/:id', auth, getBoxById);
router.post('/room/:roomId', auth, createBox);
router.put('/:id', auth, updateBox);
router.delete('/:id', auth, deleteBox);

export default router;
