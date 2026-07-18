import { Router } from 'express';
import { getMyTransferRecords } from '../controllers/transferRecordController';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/', auth, getMyTransferRecords);

export default router;
