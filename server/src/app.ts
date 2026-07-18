import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { errorHandler, notFound } from './middlewares/errorHandler';

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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (avatars, images, etc.)
app.use('/avatars', express.static(path.join(__dirname, '../public/avatars')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));
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
