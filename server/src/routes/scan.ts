import { Router } from 'express';
import { scanQrcode, borrowItem, borrowItemsBatch, returnItem, returnItemsBatch } from '../controllers/scanController';
import { auth } from '../middlewares/auth';

const router = Router();

router.post('/', auth, scanQrcode);
router.post('/borrow', auth, borrowItem);
router.post('/borrow-batch', auth, borrowItemsBatch);
router.post('/return', auth, returnItem);
router.post('/return-batch', auth, returnItemsBatch);

export default router;
