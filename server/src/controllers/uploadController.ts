import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import pool from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';

const avatarUploadDir = path.join(__dirname, '../../public/avatars');
const itemImageUploadDir = path.join(__dirname, '../../public/images');

// Ensure upload directories exist
const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const createImageFilename = () => `${crypto.randomBytes(12).toString('base64url')}.jpg`;

const deleteFileIfPresent = async (filePath: string) => {
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
};

const deleteStoredImage = async (
  publicPath: string | null | undefined,
  expectedPrefix: string,
  uploadDir: string
) => {
  if (!publicPath?.startsWith(expectedPrefix)) return;

  try {
    await deleteFileIfPresent(path.join(uploadDir, path.basename(publicPath)));
  } catch (err) {
    // The database already references the new image, so cleanup failure must not
    // turn a successful upload into a client-visible failure.
    console.error(`Failed to delete previous image ${publicPath}:`, err);
  }
};

// Avatar upload configuration
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir(avatarUploadDir);
    cb(null, avatarUploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, createImageFilename());
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
    let databaseUpdated = false;

    try {
      if (!req.file) {
        return error(res, 'No file uploaded', 400);
      }

      const userId = req.user?.userId;
      const avatarPath = `/avatars/${req.file.filename}`;
      const client = await pool.connect();
      let previousAvatar: string | null = null;

      try {
        await client.query('BEGIN');
        const userResult = await client.query(
          'SELECT user_avatar FROM users WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        if (userResult.rows.length === 0) {
          throw new Error('User not found');
        }

        previousAvatar = userResult.rows[0].user_avatar;
        await client.query(
          'UPDATE users SET user_avatar = $1 WHERE user_id = $2',
          [avatarPath, userId]
        );
        await client.query('COMMIT');
        databaseUpdated = true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      await deleteStoredImage(previousAvatar, '/avatars/', avatarUploadDir);

      return success(res, { avatar: avatarPath }, 'Avatar uploaded successfully');
    } catch (err) {
      console.error('Upload avatar error:', err);
      if (req.file && !databaseUpdated) {
        await deleteFileIfPresent(req.file.path).catch(() => {});
      }
      return error(res, 'Failed to upload avatar', 500);
    }
  },
];

// Item image upload configuration
const itemStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir(itemImageUploadDir);
    cb(null, itemImageUploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, createImageFilename());
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
    let databaseUpdated = false;

    try {
      if (!req.file) {
        return error(res, 'No file uploaded', 400);
      }

      const itemId = req.params.id;
      const userId = req.user?.userId;
      const imagePath = `/images/${req.file.filename}`;
      const client = await pool.connect();
      let previousImage: string | null = null;

      try {
        await client.query('BEGIN');
        const itemResult = await client.query(
          `SELECT item_belong_user_id, item_image
           FROM items WHERE item_id = $1 FOR UPDATE`,
          [itemId]
        );

        if (itemResult.rows.length === 0) {
          await client.query('ROLLBACK');
          await deleteFileIfPresent(req.file.path);
          return error(res, 'Item not found', 404);
        }

        if (itemResult.rows[0].item_belong_user_id !== userId) {
          await client.query('ROLLBACK');
          await deleteFileIfPresent(req.file.path);
          return error(res, 'You can only upload images for your own items', 403);
        }

        previousImage = itemResult.rows[0].item_image;
        await client.query(
          'UPDATE items SET item_image = $1 WHERE item_id = $2',
          [imagePath, itemId]
        );
        await client.query('COMMIT');
        databaseUpdated = true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      await deleteStoredImage(previousImage, '/images/', itemImageUploadDir);

      return success(res, { image: imagePath }, 'Item image uploaded successfully');
    } catch (err) {
      console.error('Upload item image error:', err);
      // Clean up file if error occurred
      if (req.file && !databaseUpdated) {
        await deleteFileIfPresent(req.file.path).catch(() => {});
      }
      return error(res, 'Failed to upload item image', 500);
    }
  },
];
