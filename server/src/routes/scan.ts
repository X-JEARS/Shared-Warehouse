import { Router } from 'express';
import { scanQrcode, borrowItem, returnItem } from '../controllers/scanController';
import { auth } from '../middlewares/auth';

const router = Router();

router.post('/', auth, scanQrcode);
router.post('/borrow', auth, borrowItem);
router.post('/return', auth, returnItem);

export default router;
