import { Router } from 'express';
import {
  getItems,
  getInHandItems,
  getItemById,
  createItem,
  updateItem,
  getHistory,
  getComments,
  addComment,
  getItemByQrcode,
  setItemTags,
  setItemRemark,
} from '../controllers/itemController';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/', auth, getItems);
router.get('/in-hand', auth, getInHandItems);
router.get('/qrcode/:code', auth, getItemByQrcode);
router.get('/:id', auth, getItemById);
router.post('/', auth, createItem);
router.put('/:id', auth, updateItem);
router.get('/:id/history', auth, getHistory);
router.get('/:id/comments', auth, getComments);
router.post('/:id/comments', auth, addComment);
router.put('/:itemId/tags', auth, setItemTags);
router.put('/:itemId/remark', auth, setItemRemark);

export default router;
