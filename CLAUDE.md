# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

固定资产管理系统 (Fixed Asset Management System) - A PWA web application for managing fixed assets across multiple warehouses with QR code scanning for borrowing/returning items.

## Development Commands

```bash
# Backend (from server/)
npm install          # Install dependencies
npm run dev          # Start development server with hot reload (port 3000)
npm run build        # Compile TypeScript to dist/
npm start            # Run production build

# Frontend (from client/)
npm install          # Install dependencies
npm run dev          # Start Vite dev server (port 5173)
npm run build        # Build for production
npm run preview      # Preview production build

# Database
psql -U postgres -d warehouse -f sql/init.sql  # Initialize database
```

## Architecture

### Backend (server/)
- **Express + TypeScript** REST API on port 3000
- **PostgreSQL** database with 13 tables (see sql/init.sql)
- **JWT authentication** via middleware in `src/middlewares/auth.ts`
- **Route structure**: Each route file imports its controller, all routes use `/api` prefix
- **Response format**: Use `success()` and `error()` helpers from `src/utils/response.ts`

### Frontend (client/)
- **React + TypeScript + Vite** on port 5173
- **Ant Design Mobile** for UI components (avoid antd-mobile-icons - use emoji instead)
- **Zustand** for state management with localStorage persistence (stores in `src/stores/`)
- **API layer**: Centralized in `src/services/api.ts`, uses axios wrapper in `src/utils/request.ts`
- **Routing**: Protected routes use `PrivateRoute` wrapper checking `useAuthStore`

### Database Schema (Key Relationships)
```
Users → Boxes (personal box: user_box_id)
Rooms → Boxes → Items
Room_Members (user-room many-to-many)
Items ↔ Tags (via item_room_tag_map, tags are room-specific)
Items → Histories (transfer records)
Items → Reservations → Orders
```

### Key Domain Concepts
- **Room (仓库)**: A warehouse/workspace that users can join
- **Box (盒子)**: Storage container within a room, or user's personal box
- **Item (物品)**: Physical asset with QR code, can be borrowed/returned
- **Tags**: Room-specific, items have different tags in different rooms
- **Cart**: Client-side only, persisted to localStorage via Zustand

## Important Patterns

### Authentication Flow
1. Login/Register returns JWT token
2. Token stored in Zustand (`authStore`) with localStorage persistence
3. `request.ts` interceptor adds `Authorization: Bearer <token>` header
4. Backend `auth` middleware validates token, injects `req.user`

### Item Borrowing/Returning
- Scan QR code → `POST /api/scan` identifies item/box
- `POST /api/scan/borrow` moves item to user's personal box
- `POST /api/scan/return` moves item to specified box
- Each transfer creates a `histories` record

### Reservation Conflict Detection
Backend checks time overlap in `reservationController.ts` before creating reservations.

## Environment Variables

Backend requires `.env` file (copy from `.env.example`):
```
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
JWT_SECRET, JWT_EXPIRES_IN
PORT, NODE_ENV
```

## PWA Notes

- Configured via `vite-plugin-pwa` in `vite.config.ts`
- Manifest in `public/manifest.json`
- Icons in `public/icons/`
- iOS add-to-homescreen requires HTTPS in production
