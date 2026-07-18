import { NextFunction, Response } from 'express';
import multer from 'multer';
import { AuthRequest } from './auth';

export const TRANSFER_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (TRANSFER_IMAGE_EXTENSIONS[file.mimetype]) {
      cb(null, true);
      return;
    }
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
  },
});

export const transferImageUpload = (req: AuthRequest, res: Response, next: NextFunction) => {
  upload.single('image')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
      ? 'Transfer image must not exceed 20MB'
      : err.message;
    res.status(400).json({ success: false, message });
  });
};
