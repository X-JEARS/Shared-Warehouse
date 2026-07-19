import express from 'express';
import cors, { CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { AppError, errorHandler, notFound } from './middlewares/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import roomRoutes from './routes/rooms';
import boxRoutes from './routes/boxes';
import itemRoutes from './routes/items';
import scanRoutes from './routes/scan';
import reservationRoutes from './routes/reservations';
import cartRoutes from './routes/cart';
import notificationRoutes from './routes/notifications';
import uploadRoutes from './routes/upload';
import transferRecordRoutes from './routes/transferRecords';
import { assertJwtConfigured } from './utils/jwt';

dotenv.config();
assertJwtConfigured();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const normalizeOrigin = (origin: string) => {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.trim().replace(/\/$/, '');
  }
};

const allowedOrigins = (process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'])
  .map(origin => origin.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
      callback(null, true);
    } else {
      const error = new Error('Not allowed by CORS') as AppError;
      error.statusCode = 403;
      callback(error);
    }
  },
  credentials: true,
};

// Requests from a frontend served by this same application do not need CORS.
// Bypass the allowlist for them so production deployments work without having
// to guess the public hostname in ALLOWED_ORIGINS.
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (!origin) {
    return next();
  }

  const forwardedProtocol = req.get('x-forwarded-proto')?.split(',')[0].trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0].trim();
  const requestOrigin = normalizeOrigin(
    `${forwardedProtocol || req.protocol}://${forwardedHost || req.get('host')}`
  );

  if (normalizeOrigin(origin) === requestOrigin) {
    return next();
  }

  return cors(corsOptions)(req, res, next);
});
app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (avatars, images, etc.)
const versionedImageOptions = { maxAge: '1y', immutable: true };
app.use('/avatars', express.static(path.join(__dirname, '../public/avatars'), versionedImageOptions));
app.use('/images', express.static(path.join(__dirname, '../public/images'), versionedImageOptions));
app.use('/transfer-images', express.static(path.join(__dirname, '../public/transfer-images')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/boxes', boxRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/transfer-records', transferRecordRoutes);

// Serve frontend static files (production)
app.use(express.static(path.join(__dirname, '../public/frontend')));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/frontend/index.html'));
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
