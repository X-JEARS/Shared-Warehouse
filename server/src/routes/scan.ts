import { Router } from 'express';
import { scanQrcode, borrowItem, borrowItemsBatch, returnItem, returnItemsBatch } from '../controllers/scanController';
import { auth } from '../middlewares/auth';
import { transferImageUpload } from '../middlewares/transferImageUpload';

const router = Router();

router.post('/', auth, scanQrcode);
router.post('/borrow', auth, borrowItem);
router.post('/borrow-batch', auth, transferImageUpload, borrowItemsBatch);
router.post('/return', auth, returnItem);
router.post('/return-batch', auth, transferImageUpload, returnItemsBatch);

export default router;
