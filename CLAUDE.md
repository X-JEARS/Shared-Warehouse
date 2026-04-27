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
- **PostgreSQL** database with 14 tables (see sql/init.sql)
- **JWT authentication** via middleware in `src/middlewares/auth.ts`
- **Route structure**: Each route file imports its controller, all routes use `/api` prefix
- **Response format**: Use `success()` and `error()` helpers from `src/utils/response.ts`

### Frontend (client/)
- **React + TypeScript + Vite** on port 5173
- **Ant Design Mobile** for UI components with outline icons from `antd-mobile-icons`. New icons must be declared in `client/src/vite-env.d.ts`.
- **Zustand** for state management with localStorage persistence (stores in `src/stores/`)
- **API layer**: Centralized in `src/services/api.ts`, uses axios wrapper in `src/utils/request.ts`
- **Routing**: Protected routes use `PrivateRoute` wrapper checking `useAuthStore`

### Database Schema (Key Relationships)
```
Users → Boxes (personal box: user_box_id)
Rooms → Boxes → Items
Room_Members (user-room many-to-many)
Room_Join_Requests (join requests requiring admin approval)
Items ↔ Tags (via item_room_tag_map, tags are room-specific)
Items → Histories (transfer records)
Items → Reservations → Orders
```

### Key Domain Concepts
- **Room (仓库)**: A warehouse/workspace that users can join (requires admin approval)
- **Box (盒子)**: Storage container within a room, or user's personal box (user_box_id)
- **Item (物品)**: Physical asset with QR code, can be taken by scanning its QR code
- **Tags**: Room-specific, items have different tags in different rooms
- **Cart**: Client-side only, persisted to localStorage via Zustand
- **Room Persistence**: `currentRoom` is persisted to localStorage, so users return to their last visited room on login/app start. Warehouse page validates that the stored room is still accessible (user is still a member)
- **Room Join Request**: Users request to join a room, admin approves/rejects in room settings

## Important Patterns

### Authentication Flow
1. Login/Register returns JWT token
2. Token stored in Zustand (`authStore`) with localStorage persistence
3. `request.ts` interceptor adds `Authorization: Bearer <token>` header
4. Backend `auth` middleware validates token, injects `req.user`

### Room Join Request Flow
- User submits join request via `POST /api/rooms/:id/request-join` with optional member name
- Request stored in `room_join_requests` table with status `pending`
- Admin sees pending requests in room settings page
- Admin can approve (`POST /api/rooms/:id/join-requests/:requestId/approve`) or reject (`POST /api/rooms/:id/join-requests/:requestId/reject`)
- Approved: User added to `room_members`, request status updated to `approved`
- Rejected: Request status updated to `rejected`, user can reapply
- User can check request status via `GET /api/rooms/:id/join-request-status`

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

### Room Settings Page
- Located at `client/src/pages/RoomSettings.tsx`, only accessible by room admin
- Uses card-based layout: each section (room info, join requests, boxes, tags, members) wrapped in a `Card` component (white background, 12px border-radius, `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1)`)
- **Room info card**: Displays room name directly (no "仓库名称：" prefix), with a blue outline-style edit icon button (SVG pencil+square, same as Profile nickname edit) inline to the right. Room ID shown below in gray.
- **Join requests card**: Shows pending requests in two-per-row grid cards with user avatar (or nickname initial placeholder) on the left, name/login name/date on the right, approve/reject buttons at card bottom
- **Box management card**: Boxes in two-per-row grid, click to rename, trash icon to delete
- **Tag management card**: Tags in wrap layout, click to rename, batch delete mode
- **Member management card**: Members in two-per-row grid cards with user avatar (or nickname initial placeholder) on the left, name/login name on the right, trash icon for non-admins

### Scanner Component
- Located at `client/src/components/Scanner.tsx`
- `onScan` callback receives scanned text, can return `boolean` or `Promise<boolean>`:
  - Return `true` to stop scanning
  - Return `false` to continue scanning (for validation failures)
- Used for both box QR codes (`box.` prefix) and item QR codes
- Camera selection: Prioritizes back camera (main camera) by detecting device labels or using `facingMode: 'environment'` constraint
- High resolution video stream (1920x1080) with continuous auto-focus for better QR code recognition
- Torch (flashlight) button in top-right corner, only visible when device supports it

### UI Components
- **ItemCard**: Vertical layout card with image on top (56x56px), item name below, then tags. Stock status badge (在库/离库/外来物品) at bottom-right corner of card. Accepts `showStockStatus` prop to toggle status display, `showCartButton` prop to show "预约" button at top-right corner (blue when not in cart, gray when added).
- **FilterBar**: Box/tag filters. When "全部" is selected for box, displays "全部" instead of "盒子".
- **MainLayout**: Responsive navigation - bottom tab bar on mobile, left sidebar (56px width) on desktop (≥768px). Sidebar shows icons and titles vertically.
- **Warehouse page**: Items displayed in adaptive grid (`repeat(auto-fill, minmax(150px, 1fr))`). In-stock items grouped by `current_box`, out-of-stock items displayed in "不在库中" section. Foreign items (from other rooms) shown with green "外来物品" badge.
- **InHand page**: Items displayed in adaptive grid with search bar, no grouping needed. No stock status displayed (items in user's hand are always "out of stock").
- **CartPopup**: Popup component for cart functionality, slides up from bottom like ItemDetail. Fixed footer at bottom with confirm button, scrollable content area above. Automatically checks for reservation conflicts when time is set, displays conflicting time periods on affected items.
- **BoxDetail page**: Shows box info (name, room, item count, notice) and item list. Has "存入物品" button that starts scanner for continuous item insertion.

### Warehouse Page Header Layout
- Left side: WarehouseSelector dropdown + settings icon (gear, only visible for room admin)
- Right side: Search button (magnifier icon) + Add item button (+ icon)
- Search bar hidden by default, click search button to show with auto-focus
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

### My Items Page (我的物品)
- Located at `client/src/pages/MyItems.tsx`, accessible from Profile page
- Shows all items where `item_belong_user_id` equals current user
- Each item card displays:
  - Item image and name
  - Current location (`display_location_name` + `current_box_name`)
  - Return location (`belong_room_name` + `belong_box_name`, labeled as "应归还到")
- Supports search functionality
- Uses `GET /api/items/my` API endpoint
- **Item Image Upload**: Click item image to upload new image, supports cropping (react-image-crop), compressed to 200x200 JPEG
- Image stored at `/images/{item_id}.jpg` on server
- Uses `POST /api/upload/items/:id/image` for image upload (multipart/form-data)
- **Item Operations**: Click "操作" button to show action sheet from bottom with options:
  - Edit name: Edit item name via center dialog
  - Transfer: Search users by nickname and transfer item ownership
  - Delete: Delete item with confirmation (red delete button text)
- **Transfer Item**: `POST /api/items/:id/transfer` with `targetUserId`, only changes owner, does not change belong box
- **Delete Item**: `DELETE /api/items/:id`, removes item and all related records (history, comments, reservations, tags, remarks)

### Profile Page (我的)
- Located at `client/src/pages/Profile.tsx`
- Features:
  - Avatar: Click to upload, supports cropping (react-image-crop), compressed to 200x200 JPEG
  - Nickname: Display with edit button below, click to modify via dialog
  - Avatar stored at `/avatars/{user_id}.jpg` on server
- Uses `POST /api/upload/avatar` for avatar upload (multipart/form-data)

### Reservation Conflict Detection
- Backend checks time overlap in `reservationController.ts` before creating reservations
- `POST /api/reservations/check-conflicts` API for batch conflict checking in cart
- Frontend `CartPopup` automatically checks conflicts when time is set, uses debounce to avoid excessive requests
- Conflict info stored in `cartStore` with `hasConflict` and `conflictingReservations` fields on each cart item

### Reservation Orders (预约订单)
- **My Reservations (我的预约)**: Located at `client/src/pages/MyReservations.tsx`, accessible from Profile page. Shows current user's reservation orders.
- **Room Reservations (仓库预约)**: Located at `client/src/pages/ReservationOrders.tsx`, shows all reservation orders for the current room.
- **API Endpoints**:
  - `GET /api/reservations/orders` - Get current user's orders
  - `GET /api/reservations/rooms/:roomId/orders` - Get all orders for a room (members only)
  - `GET /api/reservations/orders/:id` - Get order detail (owner or room members can view)
  - `DELETE /api/reservations/orders/:id` - Cancel order (owner only)
- **Permission Logic**:
  - Order detail: Owner can view and cancel; room members can view but cannot cancel
  - Frontend checks `order_user_id` against current user to show/hide cancel buttons

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
- iOS safe area: Uses `viewport-fit=cover` and `env(safe-area-inset-bottom)` to handle home indicator area
- Theme color is white (`#ffffff`) for consistent status bar appearance on iOS
