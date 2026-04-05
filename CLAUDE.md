# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

固定资产管理系统 (Fixed Asset Management System) - A PWA web application for managing fixed assets across multiple warehouses with QR code scanning. Items can flow freely between people and warehouses.

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
- **Box (盒子)**: Storage container within a room, or user's personal box (user_box_id)
- **Item (物品)**: Physical asset with QR code, can be taken by scanning its QR code
- **Tags**: Room-specific, items have different tags in different rooms
- **Cart**: Client-side only, persisted to localStorage via Zustand

## Important Patterns

### Authentication Flow
1. Login/Register returns JWT token
2. Token stored in Zustand (`authStore`) with localStorage persistence
3. `request.ts` interceptor adds `Authorization: Bearer <token>` header
4. Backend `auth` middleware validates token, injects `req.user`

### Item Taking Flow
- Scan item QR code → `POST /api/scan` identifies item, returns `isInHand` flag
- `POST /api/scan/borrow` moves item to user's personal box
- Items can flow freely between people (anyone can take an item)
- "我手中的" page shows items in user's personal box via `GET /api/items/in-hand`

### Box Detail and Item Return Flow
- Scan box QR code (starts with `box.`) → directly navigates to BoxDetail page `/box/:id`
- BoxDetail page shows box info and items inside
- Click "存入物品" button → starts scanner for item QR codes
- Scan item QR code → shows confirmation dialog
- Confirm → `POST /api/scan/return` moves item to this box
- Scanner continues for batch item insertion until user stops

### Box Management Flow
- **Adding Box**: Requires QR code (must start with `box.`) and name. QR code can be scanned or manually entered.
- **Deleting Box**: 
  - Cannot delete the last box in a room
  - If box has items, must select a target (another box or "user's hand") to move items before deletion
  - Moving items creates transfer history records automatically
- Box item count is displayed as a badge in room settings

### Scanner Component
- Located at `client/src/components/Scanner.tsx`
- `onScan` callback receives scanned text, can return `boolean` or `Promise<boolean>`:
  - Return `true` to stop scanning
  - Return `false` to continue scanning (for validation failures)
- Used for both box QR codes (`box.` prefix) and item QR codes

### UI Components
- **ItemCard**: Displays item in a compact card with image on left, name/tags on right. Stock status badge (在库/离库/外来物品) positioned at bottom-right of image. Accepts `showStockStatus` prop to toggle status display, `showCartButton` prop to show "预约" button at card bottom-right (blue when not in cart, gray when added).
- **FilterBar**: Box/tag filters. When "全部" is selected for box, displays "全部" instead of "盒子".
- **Warehouse page**: Items displayed in 2-column grid. In-stock items grouped by `current_box`, out-of-stock items displayed in "不在库中" section. Foreign items (from other rooms) shown with green "外来物品" badge.
- **InHand page**: Items displayed in 2-column grid with search bar, no grouping needed. No stock status displayed (items in user's hand are always "out of stock").
- **CartPopup**: Popup component for cart functionality, slides up from bottom like ItemDetail. Fixed footer at bottom with confirm button, scrollable content area above. Automatically checks for reservation conflicts when time is set, displays conflicting time periods on affected items.
- **BoxDetail page**: Shows box info (name, room, item count, notice) and item list. Has "存入物品" button that starts scanner for continuous item insertion.

### Warehouse Page Header Layout
- Left side: WarehouseSelector dropdown + settings icon (gear, only visible for room admin)
- Right side: Add item button (+ icon)
- FAB (bottom right): Scan button, Cart button (only visible when cart has items)
- Warehouse creation/join moved to dropdown in WarehouseSelector

### Item Stock Status Logic
- **In Stock (在库)**: Item's `current_box` is in the viewing room (`is_in_stock = true`, `is_foreign = false`)
- **Out of Stock (离库)**: Item belongs to this room but `current_box` is NOT in this room (`is_in_stock = false`, `is_foreign = false`)
- **Foreign Item (外来物品)**: Item belongs to another room but `current_box` is in this room (`is_in_stock = true`, `is_foreign = true`)
- Warehouse page displays items in two sections:
  - In-stock items: grouped by `current_box` (current location)
  - Out-of-stock items: displayed together in "不在库中" section
- `holder_nickname` shows who currently holds the item when it's out of stock
- `display_location_name`: When item is in a user's personal box (`box_belong_room_id IS NULL`), shows the user's nickname; otherwise shows the room name. Used to avoid displaying "未知仓库" for items in personal boxes.

### SQL NULL Comparison Note
When comparing values that may be NULL, use `IS DISTINCT FROM` instead of `!=`:
- `NULL != value` returns `NULL` (not `TRUE` or `FALSE`)
- `NULL IS DISTINCT FROM value` returns `TRUE`
- `NULL IS DISTINCT FROM NULL` returns `FALSE`
- Example: `CASE WHEN bb.box_belong_room_id IS DISTINCT FROM cb.box_belong_room_id` to correctly detect items moved between rooms or to personal boxes

### Item Tag Management
- Tags are room-specific, stored in `item_room_tag_map` table
- When viewing an item in a room (via `roomId` parameter), tags for that room are shown/edited
- Items can have different tags in different rooms
- Editing tags in one room does not affect tags in other rooms

### Reservation Conflict Detection
- Backend checks time overlap in `reservationController.ts` before creating reservations
- `POST /api/reservations/check-conflicts` API for batch conflict checking in cart
- Frontend `CartPopup` automatically checks conflicts when time is set, uses debounce to avoid excessive requests
- Conflict info stored in `cartStore` with `hasConflict` and `conflictingReservations` fields on each cart item

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
