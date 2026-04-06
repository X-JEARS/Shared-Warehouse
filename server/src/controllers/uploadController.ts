import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';

// Ensure upload directories exist
const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Avatar upload configuration
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/avatars');
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as AuthRequest).user?.userId;
    cb(null, `${userId}.jpg`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

export const uploadAvatar = [
  avatarUpload.single('avatar'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return error(res, 'No file uploaded', 400);
      }

      const userId = req.user?.userId;
      const avatarPath = `/avatars/${userId}.jpg`;

      await query(
        'UPDATE users SET user_avatar = $1 WHERE user_id = $2',
        [avatarPath, userId]
      );

      return success(res, { avatar: avatarPath }, 'Avatar uploaded successfully');
    } catch (err) {
      console.error('Upload avatar error:', err);
      return error(res, 'Failed to upload avatar', 500);
    }
  },
];

// Item image upload configuration - use memory storage first to validate item ownership
const itemStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/images');
    ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Use item_id from params as filename
    const itemId = req.params.id;
    cb(null, `${itemId}.jpg`);
  },
});

const itemUpload = multer({
  storage: itemStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

export const uploadItemImage = [
  itemUpload.single('image'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return error(res, 'No file uploaded', 400);
      }

      const itemId = req.params.id;
      const userId = req.user?.userId;

      // Verify item belongs to user
      const itemResult = await query(
        'SELECT item_belong_user_id FROM items WHERE item_id = $1',
        [itemId]
      );

      if (itemResult.rows.length === 0) {
        // Delete uploaded file if item not found
        fs.unlinkSync(req.file.path);
        return error(res, 'Item not found', 404);
      }

      if (itemResult.rows[0].item_belong_user_id !== userId) {
        // Delete uploaded file if not owner
        fs.unlinkSync(req.file.path);
        return error(res, 'You can only upload images for your own items', 403);
      }

      const imagePath = `/images/${itemId}.jpg`;

      // Update database with image path
      await query(
        'UPDATE items SET item_image = $1 WHERE item_id = $2',
        [imagePath, itemId]
      );

      return success(res, { image: imagePath }, 'Item image uploaded successfully');
    } catch (err) {
      console.error('Upload item image error:', err);
      // Clean up file if error occurred
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      return error(res, 'Failed to upload item image', 500);
    }
  },
];
