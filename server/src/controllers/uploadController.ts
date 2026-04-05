import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/avatars');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Use user_id as filename
    const userId = (req as AuthRequest).user?.userId;
    cb(null, `${userId}.jpg`);
  },
});

const upload = multer({
  storage,
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
  upload.single('avatar'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return error(res, 'No file uploaded', 400);
      }

      const userId = req.user?.userId;
      const avatarPath = `/avatars/${userId}.jpg`;

      // Update database with avatar path
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
