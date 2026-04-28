import { Router } from 'express';
import {
  getItems,
  getInHandItems,
  getInHandCount,
  getItemById,
  createItem,
  updateItem,
  getHistory,
  getComments,
  addComment,
  getItemByQrcode,
  setItemTags,
  setItemRemark,
  getMyItems,
  changeBelongBox,
  transferItem,
  deleteItem,
} from '../controllers/itemController';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/', auth, getItems);
router.get('/in-hand/count', auth, getInHandCount);
router.get('/in-hand', auth, getInHandItems);
router.get('/my', auth, getMyItems);
router.get('/qrcode/:code', auth, getItemByQrcode);
router.get('/:id', auth, getItemById);
router.post('/', auth, createItem);
router.put('/:id', auth, updateItem);
router.delete('/:id', auth, deleteItem);
router.get('/:id/history', auth, getHistory);
router.get('/:id/comments', auth, getComments);
router.post('/:id/comments', auth, addComment);
router.put('/:itemId/tags', auth, setItemTags);
router.put('/:itemId/remark', auth, setItemRemark);
router.put('/:id/belong-box', auth, changeBelongBox);
router.post('/:id/transfer', auth, transferItem);

export default router;
