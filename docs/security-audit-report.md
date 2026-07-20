# Security Audit Report

**Project:** Shared-Warehouse (共享仓库)  
**Date:** 2026-07-19  
**Scope:** Full codebase — Express backend + React frontend + PostgreSQL schema  
**Methodology:** Multi-phase audit (Recon → Hunt → Validate → Report)  
**Status:** All CRITICAL and HIGH findings have been addressed; capability-based scan exceptions are documented below. Follow-up PR review fixes applied in `59bccc3`.

---

## Executive Summary

This is a fixed asset management PWA with JWT auth, room-based access control, and QR-code scanning for item borrow/return. The codebase has **solid foundations** — parameterized queries are used consistently, bcrypt password hashing, React auto-escaping, and proper ownership checks on most write operations.

The audit initially revealed systematic authorization gaps on item, reservation, comment, history, and box reads, plus weak JWT lifecycle and request hardening. The implementation now applies shared item-access rules via a centralized `hasItemAccess` utility, personal-box ownership checks, token-version revocation (including legacy-token handling), an origin allowlist with input sanitization, and authentication rate limiting (skipping successful requests). Remaining medium findings and the intentional QR capability model are documented below.

**Baseline comparable:** Inventory management systems like Snipe-IT and Asset Panda. Unlike strict tenant-only systems, this application's business rules intentionally allow physical QR possession to initiate item transfers between people and warehouses. Ordinary item reads remain restricted to owners, current holders, and members of the item's owning or current room.

---

## Findings Summary

| # | Severity | Finding | Endpoint |
|---|----------|---------|----------|
| 1 | **CRITICAL** | IDOR — item data leak to any authenticated user | `GET /api/items/:id` |
| 2 | **CRITICAL** | IDOR — item data leak via QR code lookup | `GET /api/items/qrcode/:code` |
| 3 | **CRITICAL** | IDOR — scan endpoint leaks all item/box data | `POST /api/scan` |
| 4 | **CRITICAL** | IDOR — reservation data leak | `GET /api/reservations/items/:id` |
| 5 | **CRITICAL** | IDOR — comments leak with user data | `GET /api/items/:id/comments` |
| 6 | **CRITICAL** | Return flow — missing target-box authorization | `POST /api/scan/return-batch` |
| 7 | **CRITICAL** | Checkout TOCTOU — double-booking race | `POST /api/reservations/orders` |
| 8 | **HIGH** | JWT hardcoded fallback secret | All endpoints |
| 9 | **HIGH** | IDOR — history leak for personal box items | `GET /api/items/:id/history` |
| 10 | **HIGH** | IDOR — personal box content leak | `GET /api/boxes/:id` |
| 11 | **HIGH** | No token revocation (7-day validity) | Auth system |
| 12 | **HIGH** | CORS allows all origins | All endpoints |
| 13 | **HIGH** | No rate limiting on login/register | `POST /api/auth/*` |
| 14 | **HIGH** | Unauthorized borrow/return across rooms | `POST /api/scan/borrow`, `/return` |
| 15 | **MEDIUM** | SQL injection via template literal | `GET /api/items` |
| 16 | **MEDIUM** | Unauthorized commenting on any item | `POST /api/items/:id/comments` |
| 17 | **MEDIUM** | No security headers (helmet) | All responses |
| 18 | **MEDIUM** | User enumeration via registration | `POST /api/auth/register` |
| 19 | **MEDIUM** | Weak password policy (min 6 chars) | `POST /api/auth/register` |
| 20 | **MEDIUM** | Stack trace leak in error responses | All endpoints |

---

## CRITICAL Findings

### 1. IDOR — Item Data Leak to Any Authenticated User

**File:** `server/src/controllers/itemController.ts:196-275`  
**Endpoint:** `GET /api/items/:id`

**Attack:**
```
GET /api/items/42
Authorization: Bearer <attacker_valid_token>
```

**Impact:** Returns item name, QR code, owner nickname, current location, tags, remarks, and box information for items in rooms the attacker has never joined. Full data exfiltration across all rooms by incrementing item IDs.

**Root cause:** Route only applies `auth` middleware. No room membership check in the controller.

**Fix:**
```typescript
// Add room membership check after fetching item
const membership = await pool.query(
  'SELECT 1 FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
  [item.belong_room_id, req.user.userId]
);
if (membership.rows.length === 0) {
  res.status(403).json(error('Access denied'));
  return;
}
```

---

### 2. IDOR — Item Data Leak via QR Code Lookup

**File:** `server/src/controllers/itemController.ts:486-513`  
**Endpoint:** `GET /api/items/qrcode/:code`

**Attack:**
```
GET /api/items/qrcode/item.123.456
Authorization: Bearer <attacker_token>
```

**Impact:** QR codes are often predictable (format: `item.{id}.{random}`). Attacker can enumerate QR codes to discover all items, their owners, and locations across all rooms.

**Fix:** Same as #1 — add room membership verification.

---

### 3. IDOR — Scan Endpoint Leaks All Data

**File:** `server/src/controllers/scanController.ts:89-178`  
**Endpoint:** `POST /api/scan`

**Attack:**
```
POST /api/scan
Authorization: Bearer <attacker_token>
Content-Type: application/json

{"qrcode": "box.123.456"}
```

**Impact:** When scanning a box QR code, returns ALL items in that box with owner info. When scanning an item QR code, returns full item details. Complete inventory enumeration across all rooms.

**Resolution:** Box scans require room membership or personal-box ownership. Item scans remain an intentional capability-based operation: an authenticated user who possesses the physical QR code may inspect and take the item, matching the application's free-transfer model. QR values should therefore be treated as physical capability secrets and must not be exposed in public listings.

---

### 4. IDOR — Reservation Data Leak

**File:** `server/src/controllers/reservationController.ts:458-485`  
**Endpoint:** `GET /api/reservations/items/:id`

**Attack:**
```
GET /api/reservations/items/42
Authorization: Bearer <attacker_token>
```

**Impact:** Reveals reservation schedules, user nicknames, and item usage patterns across all rooms. Privacy violation and potential reconnaissance for physical theft.

**Fix:** Add room membership check before returning reservation data.

---

### 5. IDOR — Comments Leak with User Data

**File:** `server/src/controllers/itemController.ts:437-455`  
**Endpoint:** `GET /api/items/:id/comments`

**Attack:**
```
GET /api/items/42/comments
Authorization: Bearer <attacker_token>
```

**Impact:** Exfiltrates user-generated content (comments may contain sensitive info) and user profile data (nicknames, avatars) across all rooms.

**Fix:** Add room membership check.

---

### 6. Return Flow — Target Authorization

**File:** `server/src/controllers/scanController.ts:335-443`  
**Endpoint:** `POST /api/scan/return-batch`

**Attack:**
```
POST /api/scan/return-batch
Authorization: Bearer <attacker_token>
Content-Type: application/json

{"items": [{"itemId": 42, "boxId": 999}]}
```

**Business rule:** Returning an item does not require the operator to currently hold it; the application intentionally allows anyone to put a scanned item into a box they can access. The transfer record identifies the actual operator.

**Resolution:** Validate access to the target box instead. Regular boxes require room membership and personal boxes require ownership. This prevents cross-room placement without breaking the established return workflow.

**Implementation (`59bccc3`):** The previous possession check (`item_current_box_id !== userBoxId`) was removed. The return flow now checks `targetBox.box_belong_room_id` — if it's a room box, the user must be a room member; if it's a personal box, the user must own it. This aligns with the business rule that anyone can return an item to a box they have access to.

---

### 7. Checkout TOCTOU — Double-Booking Race Condition

**File:** `server/src/controllers/reservationController.ts:487-587`  
**Endpoint:** `POST /api/reservations/orders`

**Attack:** Send 50 concurrent checkout requests for the same item/time slot. Multiple succeed.

**Impact:** Double-booking of assets. Two users both believe they have exclusive access to the same item during overlapping periods.

**Fix:** Wrap conflict check + reservation creation in a single database transaction with `SELECT ... FOR UPDATE` on the items being reserved.

**Follow-up (`59bccc3`):** Added per-item `hasItemAccess` check inside the transaction, validated item existence count after locking (prevents partial-lock race), de-duplicated and sorted item IDs for deterministic lock ordering, and rejected invalid/duplicate IDs before acquiring locks.

---

## HIGH Findings

### 8. JWT Hardcoded Fallback Secret

**File:** `server/src/middlewares/auth.ts:23`, `server/src/controllers/authController.ts:8`

**Issue:** `process.env.JWT_SECRET || 'default_secret'` — if env var is unset, all tokens are signed with a publicly-known string.

**Attack:**
```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: 1, loginName: 'admin' }, 'default_secret');
// Use as Bearer token — full authentication bypass
```

**Impact:** Complete authentication bypass. Forge tokens for any user including primary admins.

**Fix:** Remove fallback. Fail startup if `JWT_SECRET` is not set:
```typescript
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

---

### 9. IDOR — History Leak for Personal Box Items

**File:** `server/src/controllers/itemController.ts:397-435`  
**Endpoint:** `GET /api/items/:id/history`

**Issue:** When `box_belong_room_id` is NULL (personal box), the LEFT JOIN membership check produces NULL and the WHERE clause doesn't filter it out.

**Impact:** Any authenticated user can read the complete borrowing history of any item — who borrowed what, when, and which box it went to.

**Fix:** Add explicit check for personal box items.

---

### 10. IDOR — Personal Box Content Leak

**File:** `server/src/controllers/boxController.ts:7-57`  
**Endpoint:** `GET /api/boxes/:id`

**Issue:** Membership check is skipped when `box.room_id` is null (personal boxes).

**Impact:** Enumerate all items in any user's personal box.

**Fix:** For personal boxes, verify the requesting user owns the box.

---

### 11. No Token Revocation

**File:** Auth system (stateless JWT)

**Issue:** Tokens remain valid for 7 days regardless of password change, account deletion, or logout. No server-side blocklist.

**Impact:** Stolen token works for 7 days. Password change does NOT invalidate existing tokens.

**Fix:** Implement token versioning (store `token_version` in users table, embed in JWT, check on each request) or use a Redis blacklist.

**Follow-up (`59bccc3`):** Extracted `isTokenActive` helper for reuse; applied token-version check to `optionalAuth` middleware as well (previously only `auth` checked). Legacy tokens without `tokenVersion` claim default to 0 for backward compatibility.

---

### 12. CORS Allows All Origins

**File:** `server/src/app.ts:27` — `app.use(cors())`

**Issue:** Default `cors()` sets `Access-Control-Allow-Origin: *`. Any website can make cross-origin requests.

**Impact:** CSRF-like attacks, credential theft via phishing sites.

**Fix:** Restrict to specific origin via `ALLOWED_ORIGINS` env var (defaults to localhost origins).

**Follow-up (`59bccc3`):** Added `.trim().filter(Boolean)` to sanitize allowlist entries (prevents whitespace in env var from causing mismatches). Added `ALLOWED_ORIGINS` to `.env.example`.

---

### 13. No Rate Limiting on Authentication

**File:** `server/src/routes/auth.ts`

**Issue:** Login and registration have zero rate limiting.

**Impact:** Unlimited credential stuffing and brute force attacks.

**Fix:** Add `express-rate-limit` with `skipSuccessfulRequests: true` (only counts failed attempts) and a custom handler that returns a structured error response.

---

### 14. Unauthorized Borrow/Return Across Rooms

**File:** `server/src/controllers/scanController.ts:182-301, 335-443`

**Issue:** Borrow/return operations verify item exists but don't check room membership.

**Impact:** Any authenticated user can borrow/return items from rooms they've never joined.

**Resolution:** Borrowing from a regular box requires membership in its current room. Returning requires access to the target box. Moving an item from another user's hand remains allowed when the operator possesses the physical item QR code, matching the free-transfer domain rule.

---

## MEDIUM Findings

### 15. SQL Injection via Template Literal

**File:** `server/src/controllers/itemController.ts:58-59`  
**Endpoint:** `GET /api/items`

**Issue:** `roomId` from query string was interpolated directly into SQL via a template literal instead of a parameterized query.

**Resolution:** Fixed during follow-up review. All uses now share the `$1` parameter already supplied to the item-list queries.

---

### 16. Unauthorized Commenting

**File:** `server/src/controllers/itemController.ts:457-484`  
**Endpoint:** `POST /api/items/:id/comments`

**Issue:** Any authenticated user could comment on any item without room membership check.

**Impact:** Spam, social engineering via comments.

**Resolution:** Fixed using the shared item-access rule applied to item details, history, comments, and reservations.

---

### 17. No Security Headers

**File:** `server/src/app.ts`

**Issue:** Missing `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`.

**Impact:** Clickjacking, MIME sniffing attacks.

**Fix:** Add `helmet()` middleware.

---

### 18. User Enumeration via Registration

**File:** `server/src/controllers/authController.ts:34`

**Issue:** Returns `'Login name already exists'` — distinct error from other failures.

**Impact:** Attacker can enumerate valid usernames.

**Fix:** Return generic error message.

---

### 19. Weak Password Policy

**File:** `server/src/controllers/authController.ts:23`

**Issue:** Minimum 6 characters, no complexity requirements, no max length (potential DoS via extremely long passwords).

**Impact:** Brute-forceable passwords, potential DoS.

**Fix:** Minimum 12 characters, max 128 characters.

---

### 20. Stack Trace Leak

**File:** `server/src/middlewares/errorHandler.ts:23`

**Issue:** Returns stack traces when `NODE_ENV=development`.

**Impact:** Information disclosure in production if misconfigured.

**Fix:** Default to hiding stack traces.

---

## Hardening Notes (Not Findings)

These are defense-in-depth suggestions, not vulnerabilities:

1. **File upload validation:** Currently trusts client-provided MIME type. Consider magic bytes validation and image re-encoding.
2. **Token storage in localStorage:** Vulnerable to XSS token theft. Consider httpOnly cookies.
3. **In-memory cart:** Lost on server restart, not shared across instances. Consider Redis or DB-backed cart.
4. **Admin CLI tool:** `server/src/tools/admin.ts` prints passwords to stdout. Don't deploy to production.
5. **Query logging:** `database.ts:34` logs all query parameters in production — may leak PII.
6. **No account lockout / MFA:** Consider adding after repeated failed attempts.

---

## Positive Patterns

The codebase does several things well:

1. **Parameterized queries** used consistently across 95%+ of SQL — SQL injection is not the norm
2. **bcrypt password hashing** with cost factor 10
3. **React auto-escaping** — no `dangerouslySetInnerHTML` found
4. **Proper ownership checks** on write operations (update/delete items, cancel reservations)
5. **Room membership checks** on list endpoints (getItems, getBoxes, getMembers)
6. **JWT middleware** properly extracts and verifies tokens
7. **Two-tier admin model** with clear separation of primary vs secondary admin
8. **Transaction usage** for borrow operations with `FOR UPDATE` row locks
9. **File upload filenames** generated with `crypto.randomBytes` (not user-controlled)
10. **Image deletion** on update using row locks to prevent race conditions

---

## Fix Status

### CRITICAL and HIGH Findings — ADDRESSED

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | CRITICAL | IDOR item data leak | `6a1161c` + `59bccc3` centralized `hasItemAccess` utility |
| 2 | CRITICAL | IDOR item leak via QR | `1b6cc53` + `59bccc3` shared access rule |
| 3 | CRITICAL | IDOR scan endpoint leak | `d21bf52` + `59bccc3` box ownership check; item scan is a documented capability exception |
| 4 | CRITICAL | IDOR reservation leak | `d5bf5d5` + `59bccc3` shared access rule |
| 5 | CRITICAL | IDOR comments leak | `d5bf5d5` + `59bccc3` shared access rule |
| 6 | CRITICAL | Return target authorization | `59bccc3` validates target box membership/ownership instead of possession |
| 7 | CRITICAL | Checkout TOCTOU race | `ad30d07` + `59bccc3` added item access check, duplicate/invalid ID validation, sorted lock ordering |
| 8 | HIGH | JWT hardcoded fallback | `524d5eb` |
| 9 | HIGH | IDOR history leak | `cdf3913` + `59bccc3` shared access rule |
| 10 | HIGH | IDOR personal box leak | `cdf3913` |
| 11 | HIGH | No token revocation | `36bc859` + `59bccc3` extracted `isTokenActive` helper, applied to `optionalAuth` as well |
| 12 | HIGH | CORS allows all origins | `b0912e5` + `59bccc3` added `.trim().filter(Boolean)` sanitization |
| 13 | HIGH | No rate limiting | `b0912e5` + `59bccc3` added `skipSuccessfulRequests`, custom handler |
| 14 | HIGH | Unauthorized borrow/return | `1d572e9` + `59bccc3` domain-aligned target checks |

### Remaining MEDIUM Findings (Not Yet Fixed)

| # | Severity | Finding |
|---|----------|---------|
| 17 | MEDIUM | No security headers (helmet) |
| 18 | MEDIUM | User enumeration via registration |
| 19 | MEDIUM | Weak password policy (min 6 chars) |
| 20 | MEDIUM | Stack trace leak in error responses |

---

## Centralized Access Control (`59bccc3`)

A new shared utility `server/src/utils/access.ts` exports `hasItemAccess(userId, itemId, executor?)`, which consolidates all item-level authorization logic into a single query:

- Item owner (`item_belong_user_id`)
- Current holder (user whose personal box matches `item_current_box_id`)
- Room members of the item's owning room OR current room

This replaces duplicated membership-check blocks across `getItemById`, `getItemByQrcode`, `getHistory`, `getComments`, `addComment`, `getItemReservations`, and `createOrder`. The optional `executor` parameter allows it to run inside transactions.

---

## Round 2 Audit — New Findings (2026-07-20)

**Scope:** Re-audit after Round 1 fixes + PR review changes (`59bccc3`). Focus on regressions introduced by PR review and previously uncovered attack surfaces.

### New Findings Summary

| # | Severity | Finding | Endpoint |
|---|----------|---------|----------|
| 21 | **HIGH** | Missing access control on `createReservation` | `POST /api/reservations` |
| 22 | **HIGH** | Direct room join without approval | `POST /api/rooms/:id/join` |
| 23 | **HIGH** | Cart checkout doesn't re-verify item access | `POST /api/cart/checkout` |
| 24 | **HIGH** | In-memory cart double-checkout race condition | `POST /api/cart/checkout` |
| 25 | **MEDIUM** | `checkConflicts` information disclosure | `POST /api/reservations/check-conflicts` |
| 26 | **MEDIUM** | `scanQrcode` item auth removed by PR review | `POST /api/scan` |
| 27 | **MEDIUM** | `processReturnItems` possession check removed | `POST /api/scan/return-batch` |
| 28 | **MEDIUM** | DoS via unbounded batch arrays | `POST /api/scan/borrow-batch`, `POST /api/scan/return-batch` |
| 29 | **MEDIUM** | Arbitrary file deletion via path traversal | `PUT /api/items/:id` → `DELETE /api/items/:id` |
| 30 | **MEDIUM** | Admin CLI password reset doesn't invalidate sessions | `tools/admin.ts` |
| 31 | **MEDIUM** | `createReservation` TOCTOU race condition | `POST /api/reservations` |
| 32 | **LOW** | User directory enumeration | `GET /api/users/search` |
| 33 | **LOW** | Transfer images enumerable without auth | `GET /transfer-images/:id.jpg` |

---

### 21. Missing Access Control on `createReservation` — HIGH

**File:** `server/src/controllers/reservationController.ts:385-427`
**Endpoint:** `POST /api/reservations`

**Issue:** Any authenticated user can create a reservation for ANY item by ID, regardless of room membership or item access. The function imports `hasItemAccess` but never calls it.

**Attack:**
```http
POST /api/reservations
Authorization: Bearer <attacker_token>
Content-Type: application/json

{"itemId": 9999, "startTime": 1753000000000, "endTime": 1754000000000}
```

**Impact:** Attacker can reserve items in rooms they don't belong to, blocking legitimate users. Contrast with `createOrder` which correctly calls `hasItemAccess` for every item.

**Fix:** Add `hasItemAccess(userId, itemId)` check before creating the reservation.

---

### 22. Direct Room Join Without Approval — HIGH

**File:** `server/src/controllers/roomController.ts:166-203`
**Endpoint:** `POST /api/rooms/:id/join`

**Issue:** Any authenticated user can join ANY room by ID without admin approval. The `requestJoinRoom` flow exists for approval-based joining, but `joinRoom` bypasses it entirely and is still route-mounted.

**Attack:**
```http
POST /api/rooms/42/join
Authorization: Bearer <attacker_token>
Content-Type: application/json

{"memberName": "Infiltrator"}
```

**Impact:** Attacker gains full member access to any room — can view all items, boxes, members, orders, and reservations. Complete authorization bypass of the room join approval system.

**Fix:** Remove the `/:id/join` route or add an invite-code / admin-approval requirement.

---

### 23. Cart Checkout Doesn't Re-verify Item Access — HIGH

**File:** `server/src/controllers/cartController.ts:126-195`
**Endpoint:** `POST /api/cart/checkout`

**Issue:** `addToCart` checks room membership at add time, but `checkout` creates reservations WITHOUT re-verifying access. Between adding to cart and checking out, a user could be removed from the room, yet the reservation is still created.

**Attack:**
1. Add item to cart while a room member
2. Get removed from the room (by admin)
3. Call checkout → reservation created despite no longer having access

**Impact:** Reservation creation bypasses access control at the critical moment. Also, `checkout` doesn't call `hasItemAccess` at all.

**Fix:** Call `hasItemAccess` for each item during checkout, inside a transaction.

---

### 24. In-Memory Cart Double-Checkout Race — HIGH

**File:** `server/src/controllers/cartController.ts:126-195`
**Endpoint:** `POST /api/cart/checkout`

**Issue:** The cart is an in-memory `Map<number, any[]>`. Two concurrent checkout requests from the same user can both read the cart before either deletes it, creating duplicate orders and reservations.

**Attack:** Send 10 concurrent `POST /api/cart/checkout` requests → 10 orders created, 10 sets of duplicate reservations.

**Impact:** Duplicate reservations, reservation spam, data integrity violation.

**Fix:** Use an atomic check-and-delete pattern (e.g., `Map.get` + `Map.delete` in a single operation), or use a database transaction with row-level locking on the order creation.

---

### 25. `checkConflicts` Information Disclosure — MEDIUM

**File:** `server/src/controllers/reservationController.ts:784-848`
**Endpoint:** `POST /api/reservations/check-conflicts`

**Issue:** No access control. Any authenticated user can query reservation conflicts for any items by ID, leaking item names, reservation times, and user nicknames.

**Attack:**
```http
POST /api/reservations/check-conflicts
Authorization: Bearer <attacker_token>
Content-Type: application/json

{"itemIds": [1,2,3,4,5], "startTime": 1753000000000, "endTime": 1754000000000}
```

**Impact:** Attacker can enumerate which items are reserved, when, and by whom — across all rooms.

**Fix:** Add `hasItemAccess` check for each item in `itemIds`.

---

### 26. `scanQrcode` Item Auth — BY DESIGN (Not a Vulnerability)

**File:** `server/src/controllers/scanController.ts:149-194`
**Endpoint:** `POST /api/scan` (item QR code path)

**Status:** ✅ **By Design** — Confirmed with product owner.

**Context:** When scanning an item QR code, the endpoint returns item details without a `hasItemAccess` check. This is the application's intentional capability-based model: physical possession of the QR code is treated as the authorization token. This was documented as a deliberate design choice in Round 1 (#3 Resolution) and remains valid.

**Note:** QR values should be treated as capability secrets and must not be exposed in public listings.

---

### 27. `processReturnItems` Possession Check — BY DESIGN (Not a Vulnerability)

**File:** `server/src/controllers/scanController.ts:366-495`
**Endpoint:** `POST /api/scan/return-batch`

**Status:** ✅ **By Design** — Confirmed with product owner.

**Context:** The return flow intentionally does not require the operator to currently hold the item. Anyone can return a scanned item into a box they have access to. This matches the application's free-transfer domain model where physical possession of the item (or its QR code) enables the return. This was documented in Round 1 (#6 Resolution) and remains valid.

---

### 28. DoS via Unbounded Batch Arrays — MEDIUM

**File:** `server/src/controllers/scanController.ts:525-537, 562-573`
**Endpoints:** `POST /api/scan/borrow-batch`, `POST /api/scan/return-batch`

**Issue:** `itemIds`/`items` arrays have no upper bound validation. Each item triggers multiple DB queries with `FOR UPDATE` row locks held for the transaction duration. `express.json()` default limit is 100KB (~20,000 integer IDs).

**Attack:**
```http
POST /api/scan/borrow-batch
Content-Type: application/json

{"itemIds": [1,2,3,...,20000]}
```

**Impact:** Denial of service — large arrays cause slow queries, lock contention, connection pool exhaustion.

**Fix:** Add a max-length check (e.g., `itemIds.length <= 50`) before processing.

---

### 29. Arbitrary File Deletion via Path Traversal — HIGH

**File:** `server/src/controllers/itemController.ts:808-815` (deleteItem) + `:379-382` (updateItem)
**Endpoints:** `PUT /api/items/:id` → `DELETE /api/items/:id`

**Issue:** `updateItem` allows setting `item_image` to ANY string (no validation). `deleteItem` uses `path.join(__dirname, '../../public', item_image)` without sanitization. An attacker can set `item_image` to a path outside the public directory.

**Attack:**
```http
PUT /api/items/123
{"image": "../../images/victim-image.jpg"}

DELETE /api/items/123
```

**Impact:** Delete any file writable by the Node process. Can delete other users' item images or traverse to arbitrary paths.

**Fix:** Validate `item_image` against an allowlist pattern (e.g., `/^\/images\/[a-zA-Z0-9_-]+\.(jpg|png|gif|webp)$/`). Use `path.resolve` and verify the resolved path is within the public directory.

---

### 30. Admin CLI Password Reset Doesn't Invalidate Sessions — MEDIUM

**File:** `server/src/tools/admin.ts:158-162`

**Issue:** `resetPassword` updates `user_password` but does NOT increment `token_version`. Existing JWT tokens remain valid after an admin resets a user's password. Contrast with `userController.ts:112-115` which correctly increments `token_version`.

**Impact:** Sessions survive password reset. If a user's password was compromised and an admin resets it, the attacker's existing token remains valid until it naturally expires (7 days).

**Fix:** Add `token_version = token_version + 1` to the `resetPassword` SQL UPDATE.

---

### 31. `createReservation` TOCTOU Race — MEDIUM

**File:** `server/src/controllers/reservationController.ts:385-427`
**Endpoint:** `POST /api/reservations`

**Issue:** No transaction or row-level locks between the conflict check and the reservation insert. Two concurrent requests can both pass the conflict check, then both insert, resulting in double-booking.

**Impact:** Double-booking of assets. Two users both believe they have exclusive access.

**Fix:** Wrap access validation, conflict checking, and insertion in one transaction. Lock the corresponding `items` row with `SELECT ... FOR UPDATE` before checking conflicts so concurrent creation attempts serialize even when no reservation row exists yet. All multi-item creation paths lock item IDs in a deterministic order.

---

### 32. User Directory Enumeration — LOW

**File:** `server/src/controllers/userController.ts:7-33`
**Endpoint:** `GET /api/users/search?keyword=a`

**Issue:** Any authenticated user can search the full user directory by nickname substring. No rate limiting.

**Impact:** Attacker can enumerate all users by brute-forcing single characters. Returns user_id, nickname, avatar.

**Fix:** Add rate limiting to the search endpoint, or require a minimum keyword length.

---

### 33. Transfer Images Enumerable Without Auth — LOW

**File:** `server/src/app.ts:48`
**Endpoint:** `GET /transfer-images/:id.jpg`

**Issue:** Transfer images are served via `express.static` without authentication. Files are named `{transferRecordId}.{ext}` with sequential IDs. Any user can browse all transfer photos.

**Impact:** Transfer images may show who borrowed/returned what, when. Privacy concern.

**Fix:** Add authentication middleware to the `/transfer-images` route, or serve images through a controller with access checks.

---

## Updated Fix Status

### New Findings — NOT YET FIXED

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 21 | HIGH | `createReservation` missing access control | ✅ Fixed (`55f058d`) |
| 22 | HIGH | Direct room join without approval | ✅ Fixed (`f0b1471`) |
| 23 | HIGH | Cart checkout doesn't re-verify access | ✅ Fixed (`91585d9`) |
| 24 | HIGH | In-memory cart double-checkout race | ✅ Fixed (`294f6e4`) |
| 25 | MEDIUM | `checkConflicts` information disclosure | ✅ Fixed (`0ce9d4d`) |
| 26 | — | `scanQrcode` item auth | ✅ By Design |
| 27 | — | `processReturnItems` possession check | ✅ By Design |
| 28 | MEDIUM | DoS via unbounded batch arrays | ✅ Fixed (`7fe6df5`) |
| 29 | HIGH | Arbitrary file deletion via path traversal | ✅ Fixed (`7f25cd7`) |
| 30 | MEDIUM | Admin CLI password reset doesn't invalidate sessions | ✅ Fixed (`9271515`) |
| 31 | MEDIUM | `createReservation` TOCTOU race | ✅ Fixed (`3afc241`) |
| 32 | LOW | User directory enumeration | ⏳ Open |
| 33 | LOW | Transfer images enumerable | ⏳ Open |

### Previously Known MEDIUM Findings — Still Open

| # | Severity | Finding |
|---|----------|---------|
| 17 | MEDIUM | No security headers (helmet) |
| 18 | MEDIUM | User enumeration via registration |
| 19 | MEDIUM | Weak password policy (min 6 chars) |
| 20 | MEDIUM | Stack trace leak in error responses |

---

## Recommended Priority (Remaining)

### Immediate (HIGH) — ALL FIXED ✅
1. ~~Fix #21: Add `hasItemAccess` to `createReservation`~~ → `55f058d`
2. ~~Fix #22: Remove or protect `POST /api/rooms/:id/join`~~ → `f0b1471`
3. ~~Fix #23: Add `hasItemAccess` re-verification in cart checkout~~ → `91585d9`
4. ~~Fix #24: Atomic cart checkout (DB transaction or locking)~~ → `294f6e4`
5. ~~Fix #29: Validate `item_image` path in updateItem/deleteItem~~ → `7f25cd7`

### Short-term (MEDIUM)
6. ~~Fix #25: Add `hasItemAccess` to `checkConflicts`~~ → `0ce9d4d`
7. ~~Fix #28: Add max-length validation to batch arrays~~ → `7fe6df5`
8. ~~Fix #30: Increment `token_version` in admin CLI resetPassword~~ → `9271515`
9. ~~Fix #31: Wrap `createReservation` in transaction with locking~~ → `3afc241`
10. Fix #17: Add helmet middleware
11. Fix #18: Generic error message on registration
12. Fix #19: Stronger password policy (min 12 chars, max 128)
13. Fix #20: Hide stack traces in production

### Long-term (LOW + Hardening)
14. Fix #32: Rate limit user search
15. Fix #33: Authenticate transfer image access
16. Implement remaining hardening notes from Round 1

---

## Post-Fix Regressions (Found During Code Review)

Three regressions were introduced by the Round 2 fixes and subsequently fixed:

### Regression 1: Cart Data Loss on Access Check Failure — HIGH

**Introduced by:** Fix #24 (`294f6e4`) — "prevent double-checkout race"
**File:** `server/src/controllers/cartController.ts:135-160`

**Bug:** The atomic cart delete (`carts.delete(userId)`) was placed before the `hasItemAccess` re-verification. If the access check failed (e.g., user removed from room between adding to cart and checkout), the cart was permanently lost AND an orphaned order was created in the database.

**User-visible impact:** User's cart silently disappears. They have to re-add all items.

**Fix:** Moved `hasItemAccess` check before order creation. A follow-up placed access checks, conflict checks, order creation, and reservation inserts in one transaction. Any database failure rolls back and restores the claimed cart, merging it with items added while checkout was running.
**Commit:** `05d017a`

**Before (buggy):**
```
carts.delete(userId)          ← cart gone
create order in DB            ← orphaned order
if (!hasItemAccess(...))      ← too late, cart already lost
  return error(403)
```

**After (fixed):**
```
carts.delete(userId)          ← cart gone
if (!hasItemAccess(...))      ← check FIRST
  carts.set(userId, cart)     ← restore on failure
  return error(403)
create order in DB            ← only if access OK
```

---

### Regression 2: hasItemAccess Outside Transaction — LOW

**Introduced by:** Fix #21/#31 (`55f058d` / `3afc241`) — "add access check + TOCTOU transaction"
**File:** `server/src/controllers/reservationController.ts:398-440`

**Bug:** The `hasItemAccess` check was performed outside the transaction, while the conflict check + insert was inside. This created a TOCTOU window where a user could be removed from a room between the access check and the `FOR UPDATE` lock. Inconsistent with `createOrder` which correctly passes the transaction client.

**Fix:** Moved `hasItemAccess` inside the transaction, passing `client` as the executor parameter.
**Commit:** `4a98797`

---

### Regression 3: Silent Image Update Failure — LOW

**Introduced by:** Fix #29 (`7f25cd7`) — "prevent path traversal"
**File:** `server/src/controllers/itemController.ts:379-387`

**Bug:** The image path validation silently skipped invalid paths. If a user sent `{"image": "../../etc/passwd"}`, the regex wouldn't match, the update would be silently dropped, but the API still returned 200 OK "Item updated" (assuming other fields were valid). Client had no way to know the image wasn't changed.

**Fix:** Invalid image path now returns 400 with `"Invalid image path"` error message.
**Commit:** `bfd30c5`

**Follow-up after PR #2:** Item creation and update now accept only generated `/images/...` paths. File deletion strips the public URL's leading slash before resolving it beneath `server/public`, so valid images are deleted while traversal and `/avatars/...` paths are rejected.

---

## Complete Fix Commit History

| Commit | Description | Fixes |
|--------|-------------|-------|
| `f0b1471` | Remove direct joinRoom route | #22 (HIGH) |
| `55f058d` | Add hasItemAccess to createReservation | #21 (HIGH) |
| `91585d9` | Re-verify item access at checkout | #23 (HIGH) |
| `294f6e4` | Prevent double-checkout race | #24 (HIGH) |
| `7f25cd7` | Prevent path traversal in image update/delete | #29 (HIGH) |
| `9271515` | Increment token_version on admin CLI password reset | #30 (MEDIUM) |
| `0ce9d4d` | Add hasItemAccess to checkConflicts | #25 (MEDIUM) |
| `7fe6df5` | Add max-length validation to batch arrays | #28 (MEDIUM) |
| `3afc241` | Wrap createReservation in transaction | #31 (MEDIUM) |
| `05d017a` | Restore cart on access check failure | Regression 1 (HIGH) |
| `4a98797` | Move hasItemAccess inside transaction | Regression 2 (LOW) |
| `bfd30c5` | Return error for invalid image path | Regression 3 (LOW) |
