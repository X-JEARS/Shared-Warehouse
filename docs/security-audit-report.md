# Security Audit Report

**Project:** Shared-Warehouse (共享仓库)  
**Date:** 2026-07-19  
**Scope:** Full codebase — Express backend + React frontend + PostgreSQL schema  
**Methodology:** Multi-phase audit (Recon → Hunt → Validate → Report)  
**Status:** All CRITICAL and HIGH findings have been addressed; capability-based scan exceptions are documented below

---

## Executive Summary

This is a fixed asset management PWA with short-lived Access JWTs, rotating Refresh Token sessions, room-based access control, and QR-code scanning for item borrow/return. The codebase has **solid foundations** — parameterized queries are used consistently, bcrypt password hashing, React auto-escaping, and proper ownership checks on most write operations.

The audit initially revealed systematic authorization gaps on item, reservation, comment, history, and box reads, plus weak JWT lifecycle and request hardening. The implementation now applies shared item-access rules, personal-box ownership checks, token-version revocation, short-lived Access JWTs, hashed rotating Refresh Tokens with reuse detection, an origin allowlist, and authentication rate limiting. Remaining medium findings and the intentional QR capability model are documented below.

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

---

### 7. Checkout TOCTOU — Double-Booking Race Condition

**File:** `server/src/controllers/reservationController.ts:487-587`  
**Endpoint:** `POST /api/reservations/orders`

**Attack:** Send 50 concurrent checkout requests for the same item/time slot. Multiple succeed.

**Impact:** Double-booking of assets. Two users both believe they have exclusive access to the same item during overlapping periods.

**Fix:** Wrap conflict check + reservation creation in a single database transaction with `SERIALIZABLE` isolation level, or use `SELECT ... FOR UPDATE` on the items being reserved.

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

---

### 12. CORS Allows All Origins

**File:** `server/src/app.ts:27` — `app.use(cors())`

**Issue:** Default `cors()` sets `Access-Control-Allow-Origin: *`. Any website can make cross-origin requests.

**Impact:** CSRF-like attacks, credential theft via phishing sites.

**Fix:** Restrict to specific origin:
```typescript
app.use(cors({ origin: 'https://yourdomain.com', credentials: true }));
```

---

### 13. No Rate Limiting on Authentication

**File:** `server/src/routes/auth.ts`

**Issue:** Login and registration have zero rate limiting.

**Impact:** Unlimited credential stuffing and brute force attacks.

**Fix:** Add `express-rate-limit`:
```typescript
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
app.use('/api/auth/', authLimiter);
```

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
6. **Authentication lifecycle** uses short-lived Access JWTs, hashed rotating Refresh Tokens, token-family reuse detection, and password-change revocation
7. **Two-tier admin model** with clear separation of primary vs secondary admin
8. **Transaction usage** for borrow operations with `FOR UPDATE` row locks
9. **File upload filenames** generated with `crypto.randomBytes` (not user-controlled)
10. **Image deletion** on update using row locks to prevent race conditions

---

## Fix Status

### CRITICAL and HIGH Findings — ADDRESSED

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | CRITICAL | IDOR item data leak | `6a1161c` + follow-up shared access rule |
| 2 | CRITICAL | IDOR item leak via QR | `1b6cc53` + follow-up query correction |
| 3 | CRITICAL | IDOR scan endpoint leak | `d21bf52`; item scan is a documented capability exception |
| 4 | CRITICAL | IDOR reservation leak | `d5bf5d5` + follow-up shared access rule |
| 5 | CRITICAL | IDOR comments leak | `d5bf5d5` + follow-up shared access rule |
| 6 | CRITICAL | Return target authorization | Follow-up review; possession is not required by design |
| 7 | CRITICAL | Checkout TOCTOU race | `ad30d07` |
| 8 | HIGH | JWT hardcoded fallback | `524d5eb` |
| 9 | HIGH | IDOR history leak | `cdf3913` + follow-up shared access rule |
| 10 | HIGH | IDOR personal box leak | `cdf3913` |
| 11 | HIGH | No token revocation | `36bc859` + token-version checks + rotating Refresh Token sessions |
| 12 | HIGH | CORS allows all origins | `b0912e5` |
| 13 | HIGH | No rate limiting | `b0912e5` |
| 14 | HIGH | Unauthorized borrow/return | `1d572e9` + follow-up domain-aligned target checks |

### Remaining MEDIUM Findings (Not Yet Fixed)

| # | Severity | Finding |
|---|----------|---------|
| 17 | MEDIUM | No security headers (helmet) |
| 18 | MEDIUM | User enumeration via registration |
| 19 | MEDIUM | Weak password policy (min 6 chars) |
| 20 | MEDIUM | Stack trace leak in error responses |

---

## Recommended Priority (Remaining)

1. **Medium term:** Fix #17 (security headers) and #18-20 (remaining medium items)
2. **Long term:** Replace raw item-ID borrow/return submissions with short-lived signed scan grants if the server must cryptographically prove physical QR possession. The current API preserves backward compatibility and treats authenticated QR scanning as the capability boundary.
3. **Long term:** Implement the remaining hardening notes
