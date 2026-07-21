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
npm run admin        # Run admin CLI tool (search users, modify nickname, reset password)

# Frontend (from client/)
npm install          # Install dependencies
npm run dev          # Start Vite dev server (port 5173)
npm run build        # Build for production
npm run preview      # Preview production build

# Database
psql -U postgres -d warehouse -f sql/init.sql  # Initialize database
psql -v ON_ERROR_STOP=1 -U postgres -d warehouse -f sql/upgrade_room_admins_and_transfer_records.sql  # Upgrade an existing pre-admin database
psql -v ON_ERROR_STOP=1 -U postgres -d warehouse -f sql/migrations/add_token_version.sql  # Add JWT revocation support to an existing database
psql -v ON_ERROR_STOP=1 -U postgres -d warehouse -f sql/migrations/003_refresh_tokens.sql  # Add rotating refresh-token sessions
```

## Architecture

### Backend (server/)
- **Express + TypeScript** REST API on port 3000
- **PostgreSQL** database with 17 tables (see sql/init.sql)
- **Authentication**: short-lived Access JWTs plus rotating, hashed Refresh Token sessions; token versions are checked against the database so password changes revoke all active credentials
- **Request hardening**: same-origin requests are accepted automatically, cross-origin requests use the configured CORS allowlist, and login/registration are rate limited
- **Route structure**: Each route file imports its controller, all routes use `/api` prefix
- **Response format**: Use `success()` and `error()` helpers from `src/utils/response.ts`

### Frontend (client/)
- **React + TypeScript + Vite** on port 5173
- **Ant Design Mobile** for UI components with outline icons from `antd-mobile-icons`. New icons must be declared in `client/src/vite-env.d.ts`.
- **Zustand** for state management with localStorage persistence (stores in `src/stores/`); auth persistence excludes the Access Token, which remains memory-only
- **Theme system**: CSS variables defined in `src/styles/theme.css`, managed by `themeStore`. Supports light/dark/system color modes and default/rounded/compact style variants. Applied via `html[data-theme]` and `html[data-style]` attributes. All UI must use `var(--app-color-*)` / `var(--app-radius-*)` instead of hardcoded hex values.
- **API layer**: Centralized in `src/services/api.ts`, uses axios wrapper in `src/utils/request.ts`; SWR-backed reads use `src/utils/swr.ts` and support both URL and `[url, axiosConfig]` keys
- **Routing**: Protected routes use `PrivateRoute` wrapper checking `useAuthStore`

### Database Schema (Key Relationships)
```
Users → Boxes (personal box: user_box_id)
Users → Refresh_Tokens (rotating device sessions)
Rooms → Boxes → Items
Room_Members (user-room many-to-many)
Room_Admins (additional/secondary admins per room; primary admin is rooms.room_admin)
Room_Join_Requests (join requests requiring admin approval)
Items ↔ Tags (via item_room_tag_map, tags are room-specific)
Transfer_Records → Histories → Items
Items → Reservations → Orders
```

### Key Domain Concepts
- **Room (仓库)**: A warehouse/workspace that users can join (requires admin approval)
- **Box (盒子)**: Storage container within a room, or user's personal box (user_box_id)
- **Room Admin (管理员)**: Two tiers — a single **primary admin** (`rooms.room_admin`, the room creator) plus zero or more **additional admins** (`room_admins` table). Both tiers share the same routine management permissions (update room, add/rename/delete boxes, tags, approve/reject join requests, remove members). Only the primary admin can manage other admins (promote/demote/transfer). Room admin membership is tracked via `room_admins` table; the primary admin is NOT duplicated into `room_admins` (their admin status comes from `rooms.room_admin`).
- **Transfer Primary Admin**: `POST /api/rooms/:id/transfer-admin` (primary admin only). Moves `rooms.room_admin` to a chosen member; the old primary becomes an additional admin (inserted into `room_admins`), and the new primary is removed from `room_admins` if present. Both parties receive a notification.
- **Item (物品)**: Physical asset with QR code, can be taken by scanning its QR code
- **Tags**: Room-specific, items have different tags in different rooms
- **Cart**: Client-side only, persisted to localStorage via Zustand. Each `CartItem` records the current browsing `roomId`; `CartPopup`, the FAB badge, and checkout filter items to the current room, so switching rooms preserves independent cart views without clearing or prompting. Foreign items use the current browsing room's ID. Checkout sends `roomId`, and the backend verifies current room membership before creating the order. A successful checkout removes only that room's items. Persist version 2 drops legacy items without `roomId`. The store also includes `orderTitle` (editable order title, default generated as `用户名+的预约单#+日期简写`) and `setOrderTitle`; a manual `clearCart` still resets all items, title, and time.
- **Room Persistence**: `currentRoom` is persisted to localStorage, so users return to their last visited room on login/app start. Warehouse page validates that the stored room is still accessible (user is still a member)
- **Room Join Request**: Users request to join a room, admin approves/rejects in room settings

## Important Patterns

### Authentication Flow
1. Login returns a short-lived Access JWT in the response body and a 256-bit opaque Refresh Token in an `HttpOnly`, `Secure`-in-production, `SameSite=Lax` cookie scoped to `/api/auth`
2. The database stores only the Refresh Token SHA-256 hash, its token family, current `token_version`, and a 7-day idle expiry; there is no absolute session expiry
3. The Access Token is kept in Zustand memory only; persisted auth state excludes it. `request.ts` adds `Authorization: Bearer <token>` to API requests
4. On an eligible `401`, the Axios interceptor makes one shared `POST /api/auth/refresh` request, persists the new Access Token in memory, and retries queued requests
5. Every refresh atomically revokes the presented Refresh Token, creates its replacement with a new 7-day idle expiry, and sets the replacement cookie. Reuse outside a 10-second multi-tab concurrency grace revokes the entire token family; a grace-period collision returns `409` and the frontend retries after the shared cookie updates
6. Normal refresh copies the current `token_version` and never increments it. Password changes and admin password resets increment `users.token_version` and revoke all Refresh Token sessions
7. `POST /api/auth/logout` revokes the current token family and clears the Refresh Token cookie

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
- Scanner page enters batch borrow mode: items accumulate in a pending list, scanner keeps running
- `POST /api/scan/borrow` moves single item to user's personal box
- `POST /api/scan/borrow-batch` moves multiple items to user's personal box (partial success supported)
- Each successful scan submission creates one `transfer_records` row (`transfer_record_type = 1`) and binds all successful item histories through nullable `history_transfer_record_id`
- Items already in user's hand are shown with "已在手中" badge and excluded from borrow request
- Items can flow freely between people (anyone can take an item)
- "我手中的" page shows items in user's personal box via `GET /api/items/in-hand`
- In-hand item count shown as green badge on tab icon, fetched via `GET /api/items/in-hand/count`

### Item Return Flow
- Scanner page: scan box QR code → enters batch return mode (no longer navigates to BoxDetail). Target box name shown as clickable link.
- `POST /api/scan/return` moves single item to a specified box
- `POST /api/scan/return-batch` moves multiple items to specified boxes (partial success supported)
- Each successful scan submission creates one `transfer_records` row (`transfer_record_type = 2`) and binds all successful item histories through nullable `history_transfer_record_id`
- No requirement that user must hold the item to return it
- Anyone can put an item into any box they have access to; regular boxes require room membership and personal boxes require ownership

### Notification Flow
- Notifications are per-user (each user has their own notification list with independent read status)
- **取走（borrow）**: If operator ≠ item owner, notify the item owner with content like "张三 取走了 笔记本电脑". If operator = item owner, no notification.
- **放入（return）**: If operator ≠ item owner, notify the item owner with content like "张三 将 笔记本电脑 放入了 盒子A". Also notify ALL room admins (primary + additional, from `getRoomAdminUserIds`) excluding operator and item owner, with content including room name. If operator = item owner, no owner notification.
- Notification data stored in `notifications` table with `notification_content` field for detailed info
- Unread count shown as red badge on notification bell icon in Profile page top-right corner, fetched via `GET /api/notifications/unread-count`, managed in `notificationStore` (Zustand). Notification page is a standalone route (not in tab bar), accessible from Profile page with unified sub-page Header (sticky, with ← back button).

### Box Detail and Item Return Flow
- BoxDetail page shows box info and items inside
- Click "存入物品" button → starts scanner for item QR codes in batch mode
- Scanned items accumulate in pending list (two-column grid), scanner keeps running
- Click "放入" button → confirmation dialog → `POST /api/scan/return-batch` moves all items to this box
- Items can be removed from pending list individually before confirming

### Item History Display
- History records show different text based on destination box type:
  - User's personal box (is_user_box = true): "用户名 取走了物品"
  - Regular box (is_user_box = false): "用户名 将物品放入了 盒子名"
- Backend `getHistory` query returns `is_user_box` flag and `holder_nickname` via LEFT JOIN on users table

### Sub-Page Header Pattern
- All sub-pages use a unified custom Header style instead of antd-mobile NavBar. Do NOT import `NavBar` from antd-mobile for any page.
- Pages using this pattern: MyItems, MyReservations, ReservationOrders, ReservationOrderDetail, RoomSettings, Notifications, MyProfile, AddBox, CreateItem, CreateRoom, JoinRoom, BoxDetail, SystemSettings
- **Header**: `background: var(--app-color-surface); padding: 8px 16px; border-bottom: 1px solid var(--app-color-border); display: flex; align-items: center;`
- **BackButton**: `←` arrow (font-size 20px, margin-right 12px, color: var(--app-color-text), cursor: pointer), calls `navigate(-1)`. Tab-bar pages (e.g. ReservationOrders) omit BackButton since they're accessed directly from bottom tab bar. Scanner modals use BackButton to close modal instead of navigate(-1).
- **HeaderTitle**: `font-size: 16px; font-weight: 500`
- Pages requiring sticky header (RoomSettings, Notifications) add `position: sticky; top: 0; z-index: 100`

### Room Settings Page
- Located at `client/src/pages/RoomSettings.tsx`, accessible by any room admin (primary or additional). Entry guard uses `room.is_admin` (computed by backend in `getRooms`/`getRoomById` as `room_admin === userId OR EXISTS room_admins row`).
- Header is sticky at top (position: sticky), stays fixed when scrolling page content
- Uses card-based layout: each section (room info, join requests, boxes, tags, members) wrapped in a `Card` component (background: var(--app-color-surface), border-radius: var(--app-radius-l), box-shadow: var(--app-shadow-card))
- **Room info card**: Displays room name directly (no "仓库名称：" prefix), with a blue outline-style edit icon button (SVG pencil+square, same as Profile nickname edit) inline to the right. Room ID shown below in gray.
- **Join requests card**: Shows pending requests in two-per-row grid cards with user avatar (or nickname initial placeholder) on the left, name/login name/date on the right, approve/reject buttons at card bottom
- **Box management card**: Boxes in two-per-row grid, click to rename, trash icon to delete
- **Tag management card**: Tags in wrap layout, click to rename, batch delete mode
- **Member management card**: Members in two-per-row grid cards with user avatar (or nickname initial placeholder) on the left, name/login name on the right (wraps on long names). Member count shown inline next to title. Each admin shows a badge: 「主管理员」 (primary, `var(--app-color-primary)` filled) or 「管理员」 (additional). Three header modes:
  - Default: shows "管理员" button (visible only to PRIMARY admin, via `room.room_admin === user.user_id`) and trash icon (delete members).
  - Member delete mode: trash icon → enter delete mode, select members to remove, confirm batch deletion. Admins are only deletable by the primary admin (additional admins cannot remove other admins); primary admin is never selectable. Removing a member also clears their `room_admins` row if they were an admin.
  - Admin edit mode: "管理员" button → enter admin edit mode. The card header's top-right action is `→ 转移主管理员`; cancel remains only in the bottom 「取消 / 确定」 bar. Already-admin members show blue background (`var(--app-color-primary)`); primary admin is blue but not clickable. Non-primary members are clickable to toggle admin selection. Confirm computes diff vs current admin set and batch calls `POST /api/rooms/:id/admins` (add) and `DELETE /api/rooms/:id/admins/:userId` (remove).
  - Transfer primary mode: the top-right `→ 转移主管理员` button in admin edit mode → enter transfer mode. Click a non-primary member to select (green highlight `var(--app-color-success)`). Bottom confirm triggers TWO `Dialog.confirm` confirmations, then `POST /api/rooms/:id/transfer-admin`. After transfer, old primary becomes additional admin, new primary takes over; local `room.room_admin` updated optimistically.

### Scanner Component
- Located at `client/src/components/Scanner.tsx`
- Uses `forwardRef` + `useImperativeHandle` to expose `restart()`, `pause()`, `resume()` methods
  - `restart()`: stop then start scanning (with 100ms delay)
  - `pause()`: fully releases camera (stops all tracks, clears srcObject, resets zxing reader), shows PausedPlaceholder. Used before confirmation dialogs to eliminate GPU load during animation.
  - `resume()`: calls `startScanning()` to re-acquire camera and restart decode loop
- `onScan` callback receives scanned text, can return `boolean` or `Promise<boolean>`:
  - Return `true` to stop scanning
  - Return `false` to continue scanning (for batch mode / validation failures)
- Uses refs (`onScanRef`, `onErrorRef`) internally to avoid stale closures in `decodeFromConstraints` callback
- Stream/torch detection uses delayed `useEffect` (500ms after `isScanning` becomes true) since `decodeFromConstraints` promise does not resolve in continuous mode
- `stopScanning()` stops camera tracks directly from `videoRef.current.srcObject` (not `streamRef`) to ensure camera is always released
- `isPaused` state: when true, shows PausedPlaceholder instead of ScannerContainer (Video element removed from DOM to eliminate rendering overhead)
- `showStopButton` prop (default `false`): shows built-in stop button for non-batch pages
- Camera selection: Prioritizes back camera (main camera) by detecting device labels or using `facingMode: 'environment'` constraint
- High resolution video stream (1920x1080) with continuous auto-focus for better QR code recognition
- Torch (flashlight) button in top-right corner, only visible when device supports it

### Scanner Page Flow
- Located at `client/src/pages/Scanner.tsx`
- Mode-based state machine: `idle` → `borrow` | `return`
- **idle**: First scan determines mode. Item QR → borrow mode. Box QR → return mode (sets `returnTargetBox`, shows clickable box name link). Always returns `false` to keep scanning.
- **borrow**: Scans accumulate in `pendingItems` list. Box QR codes rejected with toast. "取走" button triggers batch borrow via `POST /api/scan/borrow-batch`. Items with `isInHand` excluded from request but shown with badge.
- **return**: Scans accumulate in `pendingItems` list. Box QR codes rejected with toast. "放入" button triggers batch return via `POST /api/scan/return-batch`. Box name clickable to navigate to BoxDetail.
- **Reservation reference**: After entering borrow or return mode, an Ant Design Mobile Dropdown above the action buttons lets the user choose free operation or one of their 5 most recently created, non-canceled reservation orders associated with the currently selected room (`roomStore.currentRoom`). Ended and upcoming reservations are included; the list is not limited to currently active reservations. Data comes from `GET /api/reservations/rooms/:roomId/recent-orders` (room members only). Selecting an order shows all of its non-canceled reserved items in a two-column verification grid, but does not add them to `pendingItems`; only scanned items are submitted.
  - Borrow dots: green = already in the current user's hand, blue = scanned in this batch and ready to borrow, no dot = other state.
  - Return dots: yellow = scanned in this batch and ready to return (highest priority), green = in the current user's hand, no dot = currently in the selected room, red = held by another user or located in another room.
  - The reference Dropdown renders its popup inside a local host and disables popup, mask, and arrow transitions on the scanner page to avoid animation jank while the live camera is rendering. Other Dropdown instances keep their normal animations.
- Uses `pendingItemsRef` to avoid stale closure in dedup check
- Partial success: failed items remain in list, succeeded items removed
- **Transfer photo**: Borrow and return modes show an optional single-photo picker labeled "上传照片" on the left side of the action row. JPEG, PNG, GIF, and WebP files up to 20MB are submitted with the batch as multipart data. The selected original file is not cropped, resized, compressed, or re-encoded. A record photo is cleared after a transfer record is created, while total request failures keep it available for retry.
- "取消" button resets mode and restarts scanner
- UI layout: Fixed viewport height flex column (`height: 100dvh`). Header pinned at top (`flex-shrink: 0`). Scanner frame → hint → action row (上传照片 on the left; 取消 + 取走/放入 on the right) are fixed and non-scrolling. All three actions stay on one row. ScanResultList wrapped in `ResultListWrapper` (`flex: 1; overflow-y: auto`) scrolls independently within remaining space.

### ScanResultList Component
- Located at `client/src/components/ScanResultList.tsx`
- Displays pending items in a two-column `minmax(0, 1fr)` grid layout; cards can shrink within their columns and long item names are truncated with an ellipsis instead of widening the viewport
- Each card: item image (36x36) + name + "已在手中" badge (below name, when applicable) + location + remove (X) button
- `PendingItem` interface: `itemId`, `itemName`, `itemImage?`, `locationName`, `isInHand`, `qrcode` (for dedup)
- Shared between Scanner page and BoxDetail page
- Scrolling controlled by parent wrapper (Scanner page: `ResultListWrapper`; BoxDetail: scanner modal), no internal `max-height` constraint

### ItemDetail Component
- Located at `client/src/components/ItemDetail.tsx`, Popup-style component sliding up from bottom
- Shows item image (80x80px), name, location, stock status, tags, history, and comments
- Uses an 80vh fixed-height flex layout: the item summary above "备注" stays fixed, while the remark and every section below it share the remaining independently scrollable area
- The reservation button toggles cart membership: "预约" adds the item, while the enabled "已预约" state removes it from the cart when clicked
- **Image Viewer**: Click item image to view fullscreen. Overlay with dark background (rgba 0,0,0,0.85, z-index 9999), image centered at max 90vw × 90vh. Click anywhere on overlay to close. Only active when item has an image (cursor: pointer on image thumbnail).

### UI Components
- **ItemCard**: Vertical layout card with image on top (56x56px), item name below, then tags. Stock status badge (在库/离库/外来物品) at top-right corner of card. Accepts `showStockStatus` prop to toggle status display and `showCartButton` to show a 22px circular cart toggle at bottom-right: a light-blue "+" adds the item, then becomes a gray "-" that removes it from the cart when clicked.
- **FilterBar**: Box/tag filters. Boxes are shown as a horizontally scrollable tab row matching the ReservationOrders tab style, with "全部", "不在库中" (shows only out-of-stock items), and individual boxes. Tags are selected from a narrow, independently scrollable drawer opened by a pill-shaped FAB at the bottom-left. The drawer is constrained to the Warehouse content area so it does not cover the page header or MainLayout navigation. It lists only the room's tags (no "全部" option); when a tag is active, a text-only "取消筛选" action aligned with the FAB appears at the drawer bottom. The FAB displays "标签" with a right chevron when unfiltered and the selected tag name when active.
- **MainLayout**: Responsive navigation - bottom tab bar on mobile with centered scan button (green circular, 52px, protruding above bar) flanked by tabs: 仓库 and 预约 on the left, 我手中的 and 我的 on the right, with ScanPlaceholder (flex:1) between 预约 and 我手中的 to reserve space. ScanDome (70px clipped circle, 9px radius diff from scan button, white bg, #eee border, clip-path showing only arc above tab bar) wraps around the scan button. Left sidebar (56px width) on desktop (≥768px) with green scan button at top, then regular items vertically. In-hand icon shows green badge with held item count.
- **Warehouse page**: Items displayed in adaptive grid (`repeat(auto-fill, minmax(150px, 1fr))`). In-stock items grouped by `current_box`, items within each group sorted by name (`localeCompare` with i18n-aware locale: `i18n.language === 'en-US' ? 'en' : 'zh'`). Out-of-stock items sorted by name and displayed in "不在库中" section. Foreign items (from other rooms) shown with green "外来物品" badge.
- **InHand page**: Items displayed in adaptive grid with search bar, no grouping needed. No stock status displayed (items in user's hand are always "out of stock").
- **CartPopup**: The only cart UI; the former standalone `Cart.tsx` page and `/cart` route were removed. It slides up from the Warehouse page like ItemDetail and receives the current `roomId`, filtering display, conflict checks, and checkout to that room. The fixed footer contains the confirm button, with scrollable content above. Items use a two-column grid (item image + item name + delete icon). It automatically checks reservation conflicts when time is set and shows the conflicting item and time range. The header shows an editable order title (default: `用户名+的预约单#+日期简写`, e.g. `张三的预约单#0310`) with the blue outline edit icon. Checkout submits both `roomId` and `title`; after success, only the current room's items are removed.
- **BoxDetail page**: Shows box info (name, room, item count, notice) and item list. Has "存入物品" button that opens scanner modal in batch mode. Scanned items accumulate in pending list, "放入" button triggers batch return.

### Skeleton Loading
- Composite skeletons in `client/src/components/skeleton/` (`ItemCardSkeleton`, `ListSkeleton`, `DetailSkeleton`, `OrderSkeleton`, `FormSkeleton`), exported via the barrel `index.ts`. Each is a thin composition over antd-mobile's built-in `Skeleton` / `Skeleton.Paragraph` primitives — no custom shimmer or `SkeletonBase`. Rounded corners use `var(--app-radius-*)` so they adapt to default/rounded/compact styles.
- `client/src/hooks/useMinLoadingTime.ts` (`useMinLoadingTime(loading, minMs=300)`) keeps a skeleton on screen for at least 300ms to avoid flicker on fast loads. Use it for detail-style pages (e.g. ItemDetail) where the skeleton summary would flash otherwise.
- Page-specific skeleton use: Warehouse/InHand/MyItems use `ItemCardSkeleton × 8` in the item grid; BoxDetail uses `DetailSkeleton + ItemCardSkeleton × 6`; RoomSettings uses `DetailSkeleton + ListSkeleton × 4 + ItemCardSkeleton × 4`; Notifications/MyTransferRecords use `ListSkeleton`; MyReservations/ReservationOrders use `OrderSkeleton × 4`; ReservationOrderDetail uses `DetailSkeleton`; CreateItem shows `FormSkeleton` only for the selector area (form fields render immediately); ItemDetail uses `DetailSkeleton` for the summary area.
- SWR-backed read pages set `keepPreviousData: true` so refresh does not re-trigger the skeleton; only a true first load (or a route-`id` change in BoxDetail/ReservationOrderDetail, where `setLoading(true)` lives in the `[id]` effect) shows the skeleton — business refreshes must not re-flip loading to avoid skeleton on every refetch.
- Pages intentionally without skeleton: Scanner (the overlay is camera init, not data loading) and CartPopup (synchronous Zustand read, no loading state).
- `theme.css` overrides `.adm-skeleton` for dark-mode contrast and disables animation under `@media (prefers-reduced-motion: reduce)`.
- `App.tsx` lazy-route `PageFallback` shows a branded fallback (PWA `/icons/icon-192.png` + primary `SpinLoading`) instead of a bare spinner.

### Warehouse Page Header Layout
- Left side: WarehouseSelector dropdown + settings icon (gear, only visible for room admin, i.e. `currentRoom.is_admin`). When pending join requests exist, a red badge with the request count is shown on the gear icon.
- Right side: Search button (magnifier icon) + Add item button (+ icon)
- Search bar hidden by default, click search button to show with auto-focus
- FABs: Tag filter pill at bottom left (always visible when a room is selected) and Cart button at bottom right (only visible when the current room's cart has items; its badge is also scoped to the current room)
- Warehouse creation/join moved to dropdown in WarehouseSelector
- **WarehouseSelector** component renders immediately using roomStore data (no loading state). Fetches rooms asynchronously on mount to refresh data and validate that `currentRoom` is still accessible (user is still a member). If current room is invalid, switches to first room. Shared between Warehouse and ReservationOrders pages.

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
- Each upload gets a new random filename under `/images/`; after the database switches to the new path, the previous item image is deleted
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
  - Notification bell icon in top-right corner of header, with red badge showing unread count. Click navigates to `/notifications` (standalone route without tab bar).
  - Avatar and nickname displayed in header (display-only, no inline editing)
  - Menu items use outline icons from `antd-mobile-icons`: 我的资料 (`UserOutline`), 我的物品 (`AppstoreOutline`), 我的预约 (`CalendarOutline`), 我的存取 (`UnorderedListOutline`), 系统设置 (`SetOutline`), 关于 (`InformationCircleOutline`)
  - Menu is divided into three sections: 我的资料 + 我的物品 + 我的预约 + 我的存取 in the first group, 系统设置 in the second group (separated by gap), 关于 in the third group

### Transfer Records (转移记录)
- `transfer_records` is the parent checklist for one borrow or return submission. `transfer_record_type` is `SMALLINT`: `1` = borrow, `2` = return.
- `histories.history_transfer_record_id` is nullable so legacy histories and maintenance moves can remain ungrouped.
- Optional original photos are stored under `/transfer-images/{transfer_record_id}.{ext}`; the database stores the public path in `transfer_record_image`.
- `GET /api/transfer-records` returns only the authenticated user's records with nested item histories and pagination.
- `client/src/pages/MyTransferRecords.tsx` is the standalone `/my-transfer-records` page, reached from Profile. It displays type, time, item checklist, destination, and an expandable record photo.

### Theme System
- Located at `client/src/stores/themeStore.ts` (Zustand store with localStorage persistence)
- CSS variables defined in `client/src/styles/theme.css`, imported in `main.tsx`
- Theme is applied via `html[data-theme]` attribute (light/dark) and `html[data-style]` attribute (default/rounded/compact)
- Store initialized in `main.tsx` before React renders to prevent flash of wrong theme
- `applyTheme` also synchronizes `color-scheme`, the `theme-color` meta tag, and iOS `apple-mobile-web-app-status-bar-style`. `index.html` applies the persisted theme in an inline head script before app startup because iOS standalone mode may snapshot the status bar style before React initializes.
- **Theme modes** (`ThemeMode`): `light`, `dark`, `system` (follows OS `prefers-color-scheme` media query, auto-updates on system change)
- **Style variants** (`StyleVariant`): `default` (standard antd-mobile), `rounded` (large border-radius, cartoon/playful feel), `compact` (small border-radius, minimal feel)
- CSS variables cover: colors (`--app-color-*`), semantic backgrounds (`--app-color-info/warning/success/danger-*`), shadows (`--app-shadow-*`), border-radius (`--app-radius-*`), tab bar (`--app-color-tab-bar-*`), badges (`--app-color-badge-*`), and overrides for antd-mobile's `--adm-*` variables
- All pages and components use CSS variables instead of hardcoded colors. When adding new UI elements, always use `var(--app-color-*)` and `var(--app-radius-*)` instead of hex values.

### Internationalization (i18n)
- Uses `i18next` + `react-i18next` for internationalization
- Configuration at `client/src/locales/i18n.ts`, initialized in `main.tsx` before React renders
- Translation files: `client/src/locales/zh-CN.json` (Chinese) and `client/src/locales/en-US.json` (English)
- **Language modes** (`LanguageMode`): `zh-CN`, `en-US`, `system` (follows OS language, auto-updates on system change)
- **Effective language** (`EffectiveLanguage`): `zh-CN` or `en-US` (resolved from system when mode is `system`)
- Language state managed in `themeStore` alongside theme/style settings, persisted to localStorage
- Language applied via `html[data-language]` attribute and `i18n.changeLanguage()`
- System language changes detected via `window.addEventListener('languagechange')`
- Use `useTranslation()` hook in components to access `t()` function and `i18n` instance
- All user-facing text must use `t('key')` instead of hardcoded strings. When adding new UI text, add keys to both `zh-CN.json` and `en-US.json`
- Antd-mobile built-in component text (Dialog confirm/cancel, Calendar, DatePicker, etc.) is NOT driven by `i18next`. Imperative `Dialog.confirm`/`Dialog.alert` read antd-mobile's module-level default config via `getDefaultConfig()`, NOT React context — so `<ConfigProvider>` alone does not localize them. `App.tsx` wraps the tree in `<ConfigProvider locale={...}>` (for context-driven components) AND calls `setDefaultConfig({ locale })` in a `useEffect` keyed on `effectiveLanguage` so imperative Dialogs follow the current language too. When adding antd-mobile locale work, re-import locales from `antd-mobile/es/locales/zh-CN` / `antd-mobile/es/locales/en-US`.
- Date/time formatting: use `i18n.language === 'en-US' ? 'en-US' : 'zh-CN'` for locale parameter in `toLocaleString()` / `toLocaleDateString()` calls
- Sorting: use `i18n.language === 'en-US' ? 'en' : 'zh'` for `localeCompare()` locale parameter

### System Settings Page (系统设置)
- Located at `client/src/pages/SystemSettings.tsx`, standalone route `/system-settings` (no tab bar)
- Accessible from Profile page menu item "系统设置" (uses `SetOutline` gear icon)
- Unified sub-page Header with ← back button + title "系统设置", sticky at top
- **Language setting**: Three card-style options (跟随系统 🌐 / 简体中文 中 / English En), active option has blue border + blue text. "跟随系统" option shows current effective language below label. Language change takes effect immediately via i18next.
- **Theme mode**: Three card-style options (浅色模式 ☀️ / 深色模式 🌙 / 跟随系统 💻), active option has blue border + blue text. "跟随系统" option shows current effective theme (浅色/深色) below label
- **Visual style**: Three card-style options (标准 / 圆润 / 紧凑) with preview rectangles showing border-radius differences. Active option has blue border + blue text

### My Profile Page (我的资料)
- Located at `client/src/pages/MyProfile.tsx`, standalone route `/my-profile` (no tab bar)
- Accessible from Profile page menu item "我的资料"
- Unified sub-page Header with ← back button + title "我的资料"
- Editable fields displayed as rows (label + value + arrow):
  - Avatar: Click to upload, supports cropping (react-image-crop), compressed to 200x200 JPEG
  - Login name: Display-only (no arrow)
  - Nickname: Click opens `Dialog.confirm` with Input
  - Phone number (`user_tel`): Click opens `Dialog.confirm` with Input. Shows "未设置" if empty.
  - Registration time: Display-only (no arrow), formatted via `new Date(Number(timestamp)).toLocaleDateString(i18n.language === 'en-US' ? 'en-US' : 'zh-CN')`
  - Change password: Click opens `Dialog.confirm` with current/new password inputs
- Logout button: Red solid background with white text, at bottom of page
- Uses `POST /api/upload/avatar` for avatar upload, `PUT /users/profile` for nickname/phone updates, `PUT /users/password` for password changes

### Avatar and Item Image Caching
- Avatar and item image uploads use new random filenames on every update; the database stores the versioned public path and the previous file is deleted after a successful switch
- Upload database changes use row locks so concurrent updates serialize and do not leave an intermediate image behind
- `/avatars` and `/images` are served with `Cache-Control: public, max-age=31536000, immutable`; clients must use the returned path directly and must not append per-render timestamps
- Production reverse proxies that serve or cache these paths must preserve equivalent immutable caching behavior, and the service process needs write/delete permission for both upload directories

### Reservation Conflict Detection
- Backend checks time overlap in `reservationController.ts` before creating reservations
- `POST /api/reservations/check-conflicts` API for batch conflict checking in cart
- Frontend `CartPopup` automatically checks conflicts when time is set, uses debounce to avoid excessive requests
- Conflict info stored in `cartStore` with `hasConflict` and `conflictingReservations` fields on each cart item

### Reservation Orders (预约订单)
- **My Reservations (我的预约)**: Located at `client/src/pages/MyReservations.tsx`, accessible from Profile page. Shows current user's reservation orders. Uses unified sub-page Header with ← back button, and custom TabBar (white background, tabs aligned left, 20px margin between tabs, active tab blue with underline indicator) instead of antd-mobile Tabs.
- **Room Reservations (仓库预约)**: Located at `client/src/pages/ReservationOrders.tsx`, accessed directly from bottom tab bar (no back button). Header uses WarehouseSelector dropdown (same as Warehouse page) for switching rooms, plus search button on right side. Search bar filters orders by title (matches `order_title` and fallback `预约单 #${order_id}`); its cancel button clears the query and hides the search bar. Uses same custom TabBar pattern as My Reservations, with tab counts reflecting filtered results.
- **Reservation Order Detail**: Located at `client/src/pages/ReservationOrderDetail.tsx`, uses unified sub-page Header with ← back button.
  - **Edit Order Title**: When `isOwner` (order_user_id === current user), shows blue outline-style edit icon (SVG pencil+square) inline next to the order title. Click opens `Dialog.confirm` with Input (maxLength=24). Calls `PUT /api/reservations/orders/:id/title`. Canceled orders also allow editing title (informational, not functional).
  - **Extend Order**: "延长订单" button in footer (alongside "取消整个订单"), visible only when `isOwner && !order_is_canceled && extendableReservations.length > 0`. Uses DatePicker (precision="minute", min = currentMaxEndTime + 60s) wrapped around Button via children-as-function pattern. After selecting new end time, shows confirmation dialog, then calls `PUT /api/reservations/orders/:id/extend`. Backend updates all reservations where `reservation_is_canceled = false AND reservation_end_time >= Date.now()` (includes both "即将开始" and "进行中"), checks for time conflicts in extended tail `[original_end_time, newEndTime]` for each item, sends notification to order owner.
  - Footer shown when `canCancelOrder || canExtendOrder`. Extend button uses `fill="solid"` (blue background, white text), cancel button uses `fill="solid"` (red background, white text). Footer padding-bottom uses `calc(12px + env(safe-area-inset-bottom, 0px))` for iOS safe area.
  - **Reservation items**: Supports two view modes toggled by buttons next to "预约物品" title:
    - **Card view** (default): Displayed in two-column grid (`ReservationGrid`, `grid-template-columns: repeat(2, 1fr)`). Each card shows status tag at top-left, item name below it (with `word-break: break-all`), location, time range (font-size: 12px, color: #333, font-weight: 500, separated by border-top). Cancel button is a red circular X (`CancelBtn`) positioned at top-right of card (only for owner, non-canceled reservations). Location display: items in user's personal box show "在我手中" (green text) for current user, "XXX手中" for other users; regular boxes show "room_name / box_name". Backend returns `is_user_box`, `holder_nickname`, `holder_user_id` fields. No calendar emoji before time.
    - **List view**: Single-column white card container. Each row shows a colored dot (8px, green `#00b578` if item is in user's hand, gray `#ccc` otherwise) on the left, then item name. Rows separated by thin divider line (last row has no divider).
- **Order Card Layout**: Order title + status tag at top, then reservation time (bold, font-weight: 600, separated by border-top between title and time), then item count. No creation time displayed on card. Title shows `order_title` if present, falls back to `预约单 #${order_id}`.
- **API Endpoints**:
  - `GET /api/reservations/orders` - Get current user's orders
  - `GET /api/reservations/rooms/:roomId/orders` - Get all orders for a room (members only)
  - `GET /api/reservations/rooms/:roomId/recent-orders` - Get the current user's 5 most recently created non-canceled orders associated with a room, including ended reservations, plus live item location/holder state for scanner verification
  - `GET /api/reservations/orders/:id` - Get order detail (owner or room members can view)
  - `DELETE /api/reservations/orders/:id` - Cancel order (owner only)
  - `PUT /api/reservations/orders/:id/title` - Update order title (owner only)
  - `PUT /api/reservations/orders/:id/extend` - Extend order end time for all active reservations (owner only, checks time conflicts)
- **Permission Logic**:
  - Order detail: Owner can view, cancel, edit title, and extend; room members can view but cannot cancel, edit, or extend
  - Frontend checks `order_user_id` against current user to show/hide action buttons

## Environment Variables

Backend requires `.env` file (copy from `.env.example`):
```
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
JWT_SECRET, ACCESS_TOKEN_EXPIRES_IN
PORT, NODE_ENV, ALLOWED_ORIGINS
```

`JWT_SECRET` is required. `ACCESS_TOKEN_EXPIRES_IN` defaults to `15m`. Refresh Tokens use a fixed sliding 7-day idle expiry with no absolute expiry. Production requires `NODE_ENV=production` and HTTPS because the Refresh Cookie is `Secure`. Same-origin frontend/API deployments are accepted automatically. Separately hosted frontend/API origins must remain same-site for the `SameSite=Lax` cookie (for example, `app.example.com` and `api.example.com`); `ALLOWED_ORIGINS` must contain complete frontend origins (scheme, host, and port, without paths), separated by commas. A fully cross-site deployment requires a separate `SameSite=None` plus CSRF design.

## PWA Notes

- Configured via `vite-plugin-pwa` in `vite.config.ts`
- The linked production manifest (`manifest.webmanifest`) is generated from the `manifest` object in `client/vite.config.ts`. `client/public/manifest.json` is a compatibility copy and its colors must remain aligned with that configuration.
- Icons in `public/icons/`
- iOS add-to-homescreen requires HTTPS in production
- iOS safe area: Uses `viewport-fit=cover` and `env(safe-area-inset-bottom)` to handle home indicator area
- Status bar colors match the app header surface for the effective theme: light uses `#ffffff` with the iOS `default` style; dark uses `#1a1a1a` with the iOS `black` style. Do not use the page background or brand primary color as the manifest `theme_color`, because Android derives its standalone status bar color from that value.
- Installed iOS PWAs may cache status bar and manifest metadata. After deploying metadata changes, fully close and reopen the PWA; older installations may need to be removed from the Home Screen and added again.
