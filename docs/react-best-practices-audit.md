# React Best Practices Audit Report

**Project:** Shared-Warehouse (共享仓库)  
**Date:** 2026-07-19  
**Scope:** `client/src/` — React + TypeScript + Vite frontend  
**Reference:** Vercel React Best Practices (70 rules, 8 categories)

---

## Summary

| Priority | Category | Issues Found |
|----------|----------|-------------|
| CRITICAL | Eliminating Waterfalls | 3 |
| CRITICAL | Bundle Size Optimization | 4 |
| HIGH | Server-Side Performance | 1 |
| MEDIUM-HIGH | Client-Side Data Fetching | 2 |
| MEDIUM | Re-render Optimization | 7 |
| MEDIUM | Rendering Performance | 3 |
| LOW-MEDIUM | JavaScript Performance | 3 |
| LOW | Advanced Patterns | 2 |
| **Total** | | **25** |

---

## 1. Eliminating Waterfalls (CRITICAL)

### 1.1 Sequential API calls in `Warehouse.tsx`

**File:** `pages/Warehouse.tsx:182-220`  
**Rule:** `async-parallel`

`loadItems()` and `loadJoinRequestCount()` are called sequentially in the same `useEffect`, but they are independent of each other.

```tsx
// ❌ Current — sequential
useEffect(() => {
  if (currentRoom) {
    loadItems();
    loadJoinRequestCount();
  }
}, [currentRoom, filters]);
```

Both functions are async and independent. They should be parallelized with `Promise.all`:

```tsx
// ✅ Recommended — parallel
useEffect(() => {
  if (currentRoom) {
    Promise.all([loadItems(), loadJoinRequestCount()]);
  }
}, [currentRoom, filters]);
```

**Impact:** Reduces page load time by ~50% of the slower request's latency.

---

### 1.2 Sequential data loading in `MainLayout.tsx`

**File:** `components/MainLayout.tsx:275-280`  
**Rule:** `async-parallel`

```tsx
// ❌ Current — sequential awaits
useEffect(() => {
  fetchUnreadCount();
  itemApi.getInHandCount().then((res: any) => {
    setInHandCount(res.data?.count || 0);
  }).catch(() => {});
}, [pathname]);
```

`fetchUnreadCount()` and `itemApi.getInHandCount()` are independent:

```tsx
// ✅ Recommended
useEffect(() => {
  Promise.all([
    fetchUnreadCount(),
    itemApi.getInHandCount().then((res: any) => {
      setInHandCount(res.data?.count || 0);
    }).catch(() => {}),
  ]);
}, [pathname]);
```

---

### 1.3 Awaiting before setting state in `Scanner.tsx`

**File:** `pages/Scanner.tsx:398-426`  
**Rule:** `async-defer-await`

The `useEffect` for loading reference orders calls `setSelectedOrderId(null)` before the async call, but the `t` (translation function) is in the dependency array, which could cause re-fetches when language changes. This is correct behavior, but the `if (canceled) return;` after `.catch()` is redundant since the `.finally()` already guards.

---

## 2. Bundle Size Optimization (CRITICAL)

### 2.1 No dynamic imports for heavy routes

**File:** `App.tsx:1-29`  
**Rule:** `bundle-dynamic-imports`

All 21 page components are statically imported. Pages like `Scanner` (which pulls in `@zxing/library`), `RoomSettings` (1242 lines), and `MyItems` (911 lines with `react-image-crop`) are heavy and not needed on initial load.

```tsx
// ❌ Current — all static imports
import Scanner from './pages/Scanner';
import RoomSettings from './pages/RoomSettings';
```

```tsx
// ✅ Recommended — lazy load heavy routes
import { lazy, Suspense } from 'react';

const Scanner = lazy(() => import('./pages/Scanner'));
const RoomSettings = lazy(() => import('./pages/RoomSettings'));
const MyItems = lazy(() => import('./pages/MyItems'));

// Wrap routes in <Suspense fallback={<SpinLoading />}>
```

**Impact:** Reduces initial bundle size significantly. Scanner page with `@zxing/library` is only needed when user navigates to scanner.

---

### 2.2 No preloading on hover/focus

**File:** `App.tsx`  
**Rule:** `bundle-preload`

Navigation links don't preload route chunks on hover. With lazy loading added, preloading on hover would improve perceived navigation speed.

```tsx
// ✅ Recommended — preload on hover
<Link
  to="/scanner"
  onMouseStart={() => import('./pages/Scanner')}
  onFocus={() => import('./pages/Scanner')}
>
  Scanner
</Link>
```

---

### 2.3 Third-party library barrel imports

**File:** Multiple files  
**Rule:** `bundle-barrel-imports`

```tsx
// ❌ Current — imports from antd-mobile root
import { Button, SearchBar, SpinLoading } from 'antd-mobile';
import { Dialog, Button, Toast, SpinLoading, Dialog, Dropdown, DropdownRef } from 'antd-mobile';
```

While antd-mobile supports tree-shaking, explicit subpath imports provide better guaranteed bundle reduction:

```tsx
// ✅ Recommended — direct imports
import Button from 'antd-mobile/es/components/button';
import SearchBar from 'antd-mobile/es/components/search-bar';
```

---

### 2.4 `styled-components` coexistence with antd-mobile

**File:** Throughout  
**Rule:** `bundle-analyzable-paths`

The project uses both `styled-components` and `antd-mobile` (which uses its own styling system). This adds ~15KB (gzipped) of runtime overhead. Consider migrating all custom styles to CSS modules or plain CSS (which the project already uses for themes via CSS variables).

---

## 3. Server-Side Performance (HIGH)

### 3.1 No request deduplication for API calls

**File:** `stores/notificationStore.ts:14-21`  
**Rule:** `client-swr-dedup`

`fetchUnreadCount()` can be called from multiple components (Profile, MainLayout) in rapid succession. There's no deduplication mechanism.

```tsx
// ❌ Current — no deduplication
fetchUnreadCount: async () => {
  try {
    const res: any = await notificationApi.getUnreadCount();
    set({ unreadCount: res.data?.unreadCount || 0 });
  } catch {}
}
```

**Recommendation:** Add a simple in-flight request cache or use a library like SWR/React Query for automatic request deduplication and caching.

---

## 4. Client-Side Data Fetching (MEDIUM-HIGH)

### 4.1 No caching strategy for API responses

**File:** Throughout  
**Rule:** `client-swr-dedup`

Pages like `Warehouse`, `InHand`, `MyItems` re-fetch data every time they mount with no caching. Navigating away and back causes full refetch.

**Recommendation:** Consider using SWR or React Query for stale-while-revalidate caching, especially for:
- Room list (`roomApi.getAll()`)
- Item lists (`itemApi.getAll()`, `itemApi.getInHand()`)
- Notification count

---

### 4.2 `localStorage` accessed without error handling

**File:** `stores/` (all Zustand stores with `persist`)  
**Rule:** `client-localstorage-schema`

Zustand's `persist` middleware accesses `localStorage` directly. In private browsing mode or when storage is full, this can throw. The stores also have no schema versioning for migration.

```tsx
// ✅ Recommended — add version and migration
persist(
  (set) => ({ ... }),
  {
    name: 'auth-storage',
    version: 1,
    migrate: (persistedState: any, version) => {
      if (version === 0) {
        // migrate from version 0 to 1
      }
      return persistedState;
    },
  }
)
```

---

## 5. Re-render Optimization (MEDIUM)

### 5.1 Inline object/function creation in JSX props

**File:** `pages/Warehouse.tsx:299-303`  
**Rule:** `rerender-functional-setstate`

```tsx
// ❌ Current — new function on every render
<IconButton onClick={() => {
  setShowSearch(true);
  setTimeout(() => { searchInputRef.current?.focus(); }, 100);
}}>
```

This creates a new function on every render. While not a performance bottleneck here, extracting it to a stable callback is better practice.

---

### 5.2 IIFE in JSX render path

**File:** `pages/Warehouse.tsx:367-396`  
**Rule:** `rendering-hoist-jsx`

```tsx
// ❌ Current — IIFE during render
{(() => {
  const groupedItems = inStockItems.reduce(...);
  ...
  return (Object.entries(groupedItems)...)...
})()}
```

This IIFE performs sorting and grouping during every render. It should be memoized:

```tsx
// ✅ Recommended — memoize derived data
const groupedItems = useMemo(() => {
  const grouped = inStockItems.reduce((acc, item) => { ... }, {});
  Object.values(grouped).forEach(group => {
    group.items.sort(...);
  });
  return grouped;
}, [inStockItems, i18n.language]);
```

**Impact:** Avoids re-computing groups and sorts on every render (e.g., when search text changes but `inStockItems` doesn't).

---

### 5.3 `useCartStore()` returns full array causing re-renders

**File:** `components/ItemCard.tsx:136`  
**Rule:** `rerender-derived-state`

```tsx
// ❌ Current — subscribes to entire cart items array
const { items: cartItems, addItem } = useCartStore();
const isInCart = cartItems.some((i) => i.itemId === item.item_id);
```

Every time any item is added/removed from cart, ALL `ItemCard` instances re-render because they all subscribe to `cartItems`.

```tsx
// ✅ Recommended — only subscribe to what's needed
const isInCart = useCartStore((s) => s.items.some((i) => i.itemId === item.item_id));
const addItem = useCartStore((s) => s.addItem);
```

**Impact:** In a warehouse with 100 items, adding one item to cart triggers 100 re-renders instead of 1.

---

### 5.4 Same pattern in `Warehouse.tsx`

**File:** `pages/Warehouse.tsx:169`  
**Rule:** `rerender-derived-state`

```tsx
// ❌ Current
const { items: cartItems } = useCartStore();
```

This causes the entire Warehouse page to re-render whenever cart changes.

```tsx
// ✅ Recommended
const cartItemCount = useCartStore((s) => s.items.length);
```

---

### 5.5 Same pattern in `CartPopup.tsx`

**File:** `components/CartPopup.tsx:240`  
**Rule:** `rerender-derived-state`

```tsx
// ❌ Current — destructuring multiple fields
const { items, startTime, endTime, setTime, removeItem, clearCart, orderTitle, setOrderTitle, updateConflict, clearConflicts } = useCartStore();
```

While Zustand does shallow comparison on individual fields, destructuring the entire state object can cause subtle re-render issues. Prefer individual selectors:

```tsx
// ✅ Recommended
const items = useCartStore((s) => s.items);
const startTime = useCartStore((s) => s.startTime);
const endTime = useCartStore((s) => s.endTime);
```

---

### 5.6 Same pattern in `Cart.tsx`

**File:** `pages/Cart.tsx:168`  
**Rule:** `rerender-derived-state`

```tsx
// ❌ Current
const { items, startTime, endTime, setTime, removeItem, clearCart, orderTitle, setOrderTitle } = useCartStore();
```

---

### 5.7 `useAuthStore()` subscription in `Profile.tsx`

**File:** `pages/Profile.tsx:102`  
**Rule:** `rerender-derived-state`

```tsx
// ❌ Current — subscribes to entire user object
const { user } = useAuthStore();
```

If any field of user updates, the entire Profile re-renders. Prefer:

```tsx
// ✅ Recommended
const user = useAuthStore((s) => s.user);
```

---

## 6. Rendering Performance (MEDIUM)

### 6.1 `any` type usage throughout

**File:** Throughout (20+ locations)  
**Rule:** `js-early-exit`

The codebase uses `any` extensively for API responses:

```tsx
const res: any = await itemApi.getAll({...});
setInStockItems(res.data?.inStock || []);
```

This isn't a rendering issue per se, but it prevents TypeScript from catching performance-related bugs (e.g., unnecessary re-renders from type mismatches). Define proper interfaces for API responses.

---

### 6.2 `key={index}` in lists

**File:** `components/ItemCard.tsx:170`  
**Rule:** `rendering-conditional-render`

```tsx
// ❌ Current — using array index as key
{item.tags.slice(0, 2).map((tag, index) => (
  <Tag key={index}>{tag.tag_name}</Tag>
))}
```

```tsx
// ✅ Recommended — use stable identifier
{item.tags.slice(0, 2).map((tag) => (
  <Tag key={tag.tag_name}>{tag.tag_name}</Tag>
))}
```

---

### 6.3 Emoji in render output

**File:** Multiple files  
**Rule:** `rendering-conditional-render`

Several files use emojis directly in JSX:

```tsx
// ❌ Current
{!item.item_image && '📦'}
{hasConflicts && startTime && endTime && ( ... )}
```

While not a performance issue, this is inconsistent with the i18n approach. Emojis should be avoided in favor of proper icons for accessibility.

---

## 7. JavaScript Performance (LOW-MEDIUM)

### 7.1 Repeated `localeCompare` in sort comparator

**File:** `pages/Warehouse.tsx:378,403`  
**Rule:** `js-cache-property-access`

```tsx
// ❌ Current — locale resolved on every comparison
group.items.sort((a: any, b: any) => (a.item_name || '').localeCompare(b.item_name || '', i18n.language === 'en-US' ? 'en' : 'zh'));
```

The locale string is computed on every comparison call (O(n log n) times):

```tsx
// ✅ Recommended — compute once
const locale = i18n.language === 'en-US' ? 'en' : 'zh';
group.items.sort((a: any, b: any) => (a.item_name || '').localeCompare(b.item_name || '', locale));
```

---

### 7.2 `new Date()` in render path

**File:** `pages/Cart.tsx:171`, `components/CartPopup.tsx:248`  
**Rule:** `js-cache-function-results`

```tsx
// ❌ Current — called on every render
const dateStr = new Date().toLocaleDateString(...).replace(/\//g, '');
const defaultTitle = t('cart.defaultTitle', { nickname: user?.user_nickname || 'User', date: dateStr });
```

Should be memoized with `useMemo` or computed once on mount.

---

### 7.3 `getReferenceStatus` called in render with `pendingItems.some()`

**File:** `pages/Scanner.tsx:654-666`  
**Rule:** `js-combine-iterations`

```tsx
const getReferenceStatus = (reservation: ReferenceReservation): ReferenceStatus => {
  const isScanned = pendingItems.some(item => item.itemId === reservation.reservation_item_id);
  // ...
};
```

This is called for every reservation in a `.map()`, making it O(n*m). Pre-compute a `Set` of scanned item IDs:

```tsx
const scannedIds = useMemo(() => new Set(pendingItems.map(p => p.itemId)), [pendingItems]);
// Then: scannedIds.has(reservation.reservation_item_id)
```

---

## 8. Advanced Patterns (LOW)

### 8.1 Event listener cleanup in `themeStore.ts`

**File:** `stores/themeStore.ts:93-115`  
**Rule:** `advanced-init-once`

```tsx
_init: () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', themeHandler);
  window.addEventListener('languagechange', languageHandler);
}
```

Event listeners are added but never removed. If `_init()` is called more than once (e.g., in development with StrictMode), listeners accumulate. The `_init()` is only called once from `main.tsx`, so this is low risk, but should be documented as "call only once".

---

### 8.2 `document.getElementById` for form input

**File:** `pages/Cart.tsx:188`, `components/CartPopup.tsx:265`  
**Rule:** `advanced-event-handler-refs`

```tsx
// ❌ Current — imperative DOM access
const input = document.getElementById('order-title-input') as HTMLInputElement;
const newTitle = input?.value?.trim() || '';
```

This breaks the React paradigm. Use a controlled input with `useState` or a ref:

```tsx
// ✅ Recommended — controlled input
const [titleInput, setTitleInput] = useState(orderTitle || '');
// ...
<Dialog.confirm
  content={<Input value={titleInput} onChange={setTitleInput} />}
  onConfirm={() => setOrderTitle(titleInput.trim() || undefined)}
/>
```

---

## Priority Action Items

### High Priority (Fix First)

1. **Fix Zustand selector subscriptions** (#5.3, #5.4, #5.5, #5.6, #5.7) — These cause cascading re-renders across the entire item grid. Low effort, high impact.
2. **Memoize grouped/sorted items in Warehouse** (#5.2) — Avoids recomputation on every render.
3. **Parallelize independent API calls** (#1.1, #1.2) — Simple `Promise.all` wrapping.

### Medium Priority (Plan & Schedule)

4. **Add lazy loading for heavy routes** (#2.1) — Scanner, RoomSettings, MyItems.
5. **Add API response caching** (#4.1) — Prevent redundant fetches on navigation.
6. **Optimize sort comparators** (#7.1, #7.3) — Cache locale strings and pre-compute lookup sets.

### Low Priority (Nice to Have)

7. **Add localStorage schema versioning** (#4.2)
8. **Replace `document.getElementById` with controlled inputs** (#8.2)
9. **Reduce `any` usage** — Add proper API response types
10. **Consider removing `styled-components`** in favor of CSS modules (#2.4)

---

## Positive Observations

- Good use of CSS variables for theming (no hardcoded colors)
- Proper i18n implementation with `react-i18next`
- Clean Zustand store architecture with persistence
- Good use of `useRef` for avoiding stale closures in Scanner
- Proper cleanup of camera resources and object URLs
- Good TypeScript interface definitions for domain models
- Consistent use of `useImperativeHandle` for scanner control
- Well-structured route configuration with `PrivateRoute` guard
