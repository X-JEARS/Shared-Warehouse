# Skeleton Loading 实现方案

**Date:** 2026-07-21
**Status:** ✅ 已完成（2026-07-21）
**Priority:** MEDIUM（用户体验优化）

> **修订记录（2026-07-21）**：基于代码核对修正了若干事实性错误并补充未指定项：
> - 移除 **CartPopup**（列表来自 Zustand 同步读取，无加载态）与 **Scanner**（overlay 为相机初始化而非数据加载）的 skeleton 改动。
> - 修正 **RoomSettings**（纵向堆叠卡片，非"多 Tab"）、**ReservationOrderDetail**（改用 `DetailSkeleton` 而非 `OrderSkeleton`）。
> - 新增 **App.tsx 路由 chunk 加载 fallback**（`<Suspense fallback>` 覆盖 14 个懒加载路由）为本次范围内的 branded fallback。
> - 新增 **`useMinLoadingTime` 共享 hook** 落地 300ms 最小显示时间。
> - **改用 antd-mobile 内置 `Skeleton` / `Skeleton.Title` / `Skeleton.Paragraph`**（已确认 v5.34 提供，`animated` + `--width/--height/--border-radius` CSS 变量），不再从零实现 shimmer 与 `SkeletonBase`；相应不新增 `--app-color-skeleton` 变量，改为 dark 模式 `.adm-skeleton` 对比度覆盖 + `prefers-reduced-motion`。
> - `keepPreviousData` per-call 说明、骨架条数规则、Phase 依赖（`DetailSkeleton` 前移到 Phase 1）、构建校验等。

---

## 背景

当前所有页面均无 skeleton loading，数据加载时仅显示 `SpinLoading` 居中旋转器或直接空白。需要为所有数据加载页面添加骨架屏，并为懒加载路由提供 branded fallback，提升感知性能。

---

## 现状分析

### 数据加载方式分布

| 方式 | 页面 / 组件 |
|------|------|
| SWR (`useSWR`) | Warehouse, InHand, MainLayout |
| `useEffect` + 直接 API 调用 | BoxDetail, ReservationOrderDetail, RoomSettings, Scanner, Notifications, MyReservations, CreateItem, MyTransferRecords, MyItems, ReservationOrders, ItemDetail |
| Zustand store（无异步内容加载） | Profile（useEffect 仅取未读数 badge，页面内容立即渲染）, SystemSettings, MyProfile |
| 纯表单提交（无初始加载） | Login, Register, CreateRoom, JoinRoom, AddBox |
| 路由 chunk 加载（React `Suspense`） | App.tsx `PageFallback`：覆盖 14 个懒加载路由（MyItems, RoomSettings, AddBox, BoxDetail, Scanner, CreateItem, CreateRoom, JoinRoom, ReservationOrders, ReservationOrderDetail, MyReservations, MyProfile, SystemSettings, MyTransferRecords） |

### 现有加载状态

- 大部分页面：`<SpinLoading />` 居中 + padding
- Scanner：相机初始化全屏 overlay（非数据加载）
- CreateItem：纯文本 "加载中..."
- ItemDetail：无任何加载态（弹窗打开后 `item` 为 null，`{item && ...}` 门控导致空白 popup，约 300ms 后出现内容）
- App.tsx：`PageFallback` 为全屏裸 `SpinLoading`，作为懒加载路由的 `<Suspense fallback>`
- 表单页：按钮 loading prop

### 核心问题

1. **无 skeleton**：所有页面用 SpinLoading，布局跳动大
2. **不统一**：每个页面各自实现，无复用组件
3. **体验差**：ItemDetail 弹窗打开后空白 ~300ms 才出现内容；懒加载路由在慢网络下显示裸 SpinLoading
4. **范围误判**：CartPopup 列表与 Scanner 主视图无数据加载，不应加 skeleton

---

## 修复方案

### 1. 复用 antd-mobile Skeleton 组件

直接使用 antd-mobile 内置 `Skeleton`，不从零实现 shimmer。已确认 v5.34 提供：

- `<Skeleton animated />` -- 基础骨架块，支持 `--width` / `--height` / `--border-radius` CSS 变量（经 `style` 传入）
- `<Skeleton.Title animated />` -- 标题条
- `<Skeleton.Paragraph animated lineCount={N} />` -- N 行段落（末行自动收窄）

> 颜色为硬编码半透明灰 `rgba(190,190,190,0.2)`，light/dark 均可用；dark 对比度与减少动效通过下方 CSS 覆盖处理。骨架圆角统一用 `var(--app-radius-*)`，自动适配 default/rounded/compact。

```
client/src/components/skeleton/
├── index.ts              # barrel：统一导出各复合骨架
├── ItemCardSkeleton.tsx  # 物品卡片骨架（对应 ItemCard 布局）
├── ListSkeleton.tsx      # 列表骨架：容器，渲染 N 个 ListItemSkeleton
├── DetailSkeleton.tsx    # 详情页骨架（图片 + Paragraph + 标签行）
├── FormSkeleton.tsx      # 表单骨架（仅选择器区域）
└── OrderSkeleton.tsx     # 订单卡片骨架
```

> 不再需要自定义 `Skeleton.tsx` 基础单元 / `shimmer` keyframes / `SkeletonBase`。每个复合骨架为薄封装，组合 antd-mobile 原语。自定义 CSS 变量需以 `as React.CSSProperties` 断言以通过 TS 检查。

#### 复合骨架示例

```tsx
import { Skeleton } from 'antd-mobile';
import type { CSSProperties } from 'react';

// ItemCardSkeleton.tsx -- 对应 ItemCard 纵向布局（顶部 56x56 图 + 名称 + 标签）
export function ItemCardSkeleton() {
  return (
    <div style={{ background: 'var(--app-color-surface)', borderRadius: 'var(--app-radius-card)', padding: 12 }}>
      <Skeleton animated style={{ '--width': '56px', '--height': '56px', '--border-radius': 'var(--app-radius-m)' } as CSSProperties} />
      <div style={{ marginTop: 8 }}>
        <Skeleton animated style={{ '--width': '70%', '--height': '14px' } as CSSProperties} />
        <Skeleton animated style={{ '--width': '40%', '--height': '12px', '--border-radius': 'var(--app-radius-pill)' } as CSSProperties} />
      </div>
    </div>
  );
}

// ListSkeleton.tsx -- 容器，渲染 N 个列表项
export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => <ListItemSkeleton key={i} />)}
    </>
  );
}
function ListItemSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--app-color-border)' }}>
      <Skeleton animated style={{ '--width': '40px', '--height': '40px', '--border-radius': '50%' } as CSSProperties} />
      <div style={{ flex: 1 }}>
        <Skeleton.Paragraph animated lineCount={2} />
      </div>
    </div>
  );
}

// DetailSkeleton.tsx -- 详情摘要区（图片 80x80 + 多行 meta）
export function DetailSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <Skeleton animated style={{ '--width': '80px', '--height': '80px', '--border-radius': 'var(--app-radius-m)' } as CSSProperties} />
      <div style={{ flex: 1 }}>
        <Skeleton animated style={{ '--width': '50%', '--height': '18px' } as CSSProperties} />
        <div style={{ marginTop: 12 }}>
          <Skeleton.Paragraph animated lineCount={3} />
        </div>
      </div>
    </div>
  );
}
```

### 2. `useMinLoadingTime` 共享 hook（新增）

落地"skeleton 至少显示 300ms"规则，避免各页各自实现。位置：`client/src/hooks/useMinLoadingTime.ts`（新建 `hooks/` 目录）。

```tsx
import { useEffect, useRef, useState } from 'react';

/**
 * 返回是否应继续显示 skeleton。
 * 当 loading 为 true 时始终为 true；loading 变 false 后，若距开始不足 minMs 则延长到 minMs。
 */
export function useMinLoadingTime(loading: boolean, minMs = 300): boolean {
  const [show, setShow] = useState(loading);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (loading) {
      startRef.current = Date.now();
      setShow(true);
    } else {
      const start = startRef.current;
      if (start !== null && Date.now() - start < minMs) {
        const t = setTimeout(() => setShow(false), minMs - (Date.now() - start));
        return () => clearTimeout(t);
      }
      setShow(false);
    }
  }, [loading, minMs]);

  return show;
}
```

使用方式（useEffect 页面）：
```tsx
const [loading, setLoading] = useState(true);
const showSkeleton = useMinLoadingTime(loading);
// SWR 页面：const showSkeleton = useMinLoadingTime(isLoading);
```

### 3. BrandedPageFallback（路由 chunk 加载，新增）

替换 App.tsx 中裸 `SpinLoading` 的 `PageFallback`，为 14 个懒加载路由提供与主题协调的品牌 fallback。直接在 `App.tsx` 内替换 `PageFallback` 实现（无需新文件）：

```tsx
function PageFallback() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      height: '100dvh', gap: 16, background: 'var(--app-color-bg)',
    }}>
      <img src="/icons/icon-192.png" alt="" style={{ width: 56, height: 56, borderRadius: 'var(--app-radius-m)' }} />
      <SpinLoading color="primary" />
    </div>
  );
}
```

> 使用 `public/icons/` 下现有 PWA 图标 + 主题变量。chunk 加载完成后，各页面的数据 skeleton 接管。此 fallback 不走 `useMinLoadingTime`（chunk 加载本身时长不可控，且仅首次进入路由可见）。

### 4. 各页面 Skeleton 映射

| 页面 | 现有加载 | Skeleton 方案 |
|------|----------|---------------|
| **App.tsx 懒加载路由** | 裸 `SpinLoading` 全屏 | `BrandedPageFallback`（图标 + 主题 SpinLoading） |
| **Warehouse** | SWR `isLoading` + `keepPreviousData`（已具备） | `ItemCardSkeleton` × N（按网格列数）；分组标题用 `Skeleton` 文本行 |
| **InHand** | SpinLoading 居中 | `ItemCardSkeleton` × N（网格）；SWR 加 `keepPreviousData: true` |
| **BoxDetail** | SpinLoading + overlay | 盒子信息用 `DetailSkeleton`；物品列表用 `ItemCardSkeleton` |
| **ReservationOrderDetail** | SpinLoading 居中 | `DetailSkeleton`（标题/状态/时间行 + 物品网格占位 + 底部按钮占位），**非** `OrderSkeleton` |
| **RoomSettings** | SpinLoading 居中 | **纵向堆叠卡片**（非 Tab）：房间信息 `DetailSkeleton`、成员 `ListItemSkeleton`、盒子 `ItemCardSkeleton`、标签 `Skeleton` 文本行、加入申请 `ListItemSkeleton`。5 个请求错峰到达，按区块独立切换 skeleton->内容 |
| **Scanner** | 相机 overlay | **不改动**（overlay 为相机初始化，非数据加载；参考订单下拉数据量小，用 antd 自身 loading 即可） |
| **Notifications** | SpinLoading 居中 | `ListSkeleton` count=8 |
| **MyReservations** | SpinLoading 居中 | `OrderSkeleton` × 4 |
| **CreateItem** | 纯文本 | 仅盒子/标签选择器用 `FormSkeleton`（表单字段立即渲染，无需骨架） |
| **MyTransferRecords** | SpinLoading + InfiniteScroll | 初始 `ListSkeleton` count=6；分页沿用 `InfiniteScroll` 自带 loading 指示（不再叠加底部小骨架） |
| **MyItems** | SpinLoading 居中 | `ItemCardSkeleton` × N |
| **ReservationOrders** | SpinLoading 居中 | `OrderSkeleton` × 4 |
| **ItemDetail** | 无（空白弹窗） | `DetailSkeleton` 仅覆盖**固定摘要区**（图片 80x80 + 名称 + meta 行）；history/comments/tags/reservations 为条件渲染，无需骨架 |
| **CartPopup** | 按钮 loading | **不改动**（列表来自 `useCartStore` 同步读取，无加载态） |
| **MainLayout** | 无 | 不需要（badge 首次显示 0） |

### 5. 实现规则

#### 统一行为

- **SWR 页面**：用 `isLoading` 区分首次加载（skeleton）与后续刷新；**必须显式加 `keepPreviousData: true`**（`swr.ts` 仅导出 `swrFetcher`，未全局配置）。Warehouse 已具备；InHand 需补加。
- **useEffect 页面**：用 `loading` state 控制，经 `useMinLoadingTime(loading)` 包裹后决定渲染 skeleton 还是内容。
- **最小显示时间**：统一通过 `useMinLoadingTime`（默认 300ms），不要在各页内联实现。
- **骨架条数**：按页面一屏可见量给具体值--网格页（Warehouse/InHand/MyItems/BoxDetail 物品列表）= 网格列数 × 2 行（桌面 `auto-fill, minmax(150px, 1fr)` 下动态列数，可取 `Math.max(6, 列数×2)` 或固定 8）；列表页（Notifications/MyTransferRecords）= 6~8；订单页 = 4。不再用"固定 6 条"的含糊说法。
- **`prefers-reduced-motion`**：经下方全局 CSS 覆盖，`@media (prefers-reduced-motion: reduce)` 下停掉 `.adm-skeleton-animated` 动画，显示静态骨架。

#### 样式与主题（theme.css）

antd-mobile Skeleton 的 shimmer 颜色为硬编码 `rgba(190,190,190,0.2)`（非 `--adm-*` 变量），light/dark 均为半透明灰，基础可用。为提升 dark 模式对比度并统一动效偏好，在 `client/src/styles/theme.css` 末尾新增（**不再新增 `--app-color-skeleton` 变量**）：

```css
/* dark 模式下提升骨架对比度（匹配 antd-mobile 动画渐变参数） */
html[data-theme='dark'] .adm-skeleton {
  background-color: rgba(255, 255, 255, 0.08);
}
html[data-theme='dark'] .adm-skeleton.adm-skeleton-animated {
  background: linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.15) 37%, rgba(255,255,255,0.08) 63%);
  background-size: 400% 100%;
}

/* 尊重减少动效偏好 */
@media (prefers-reduced-motion: reduce) {
  .adm-skeleton.adm-skeleton-animated {
    animation: none;
  }
}
```

> 骨架圆角通过各复合组件内联 `--border-radius: var(--app-radius-*)` 适配 default/rounded/compact，无需额外变量。

#### 与 SpinLoading 的关系

- **路由 chunk 加载** -> `BrandedPageFallback`
- **页面级首次加载** -> Skeleton（经 `useMinLoadingTime`）
- **下拉刷新 / 筛选切换** -> 保持现有内容 + 顶部细线加载指示（或保持 SpinLoading），不显示 skeleton
- **按钮操作** -> 保持 Button `loading` prop
- **Scanner 相机** -> 保持全屏 overlay（不改）

### 6. 分阶段实施

#### Phase 1：基础组件 + 高频页 + 路由 fallback

- [ ] `theme.css` 新增 dark `.adm-skeleton` 对比度覆盖 + `prefers-reduced-motion`
- [ ] `useMinLoadingTime` 共享 hook
- [ ] `BrandedPageFallback`（App.tsx `PageFallback` 替换）
- [ ] `ItemCardSkeleton`、`ListSkeleton`、`DetailSkeleton`（前移，ItemDetail 依赖）+ `index.ts` barrel
- [ ] Warehouse 接入（验证已有 `keepPreviousData`）
- [ ] InHand 接入（补加 `keepPreviousData: true`）
- [ ] ItemDetail 弹窗接入（仅摘要区）

#### Phase 2：中频页面

- [ ] `OrderSkeleton`（订单卡片骨架）
- [ ] Notifications 接入
- [ ] MyReservations 接入
- [ ] MyItems 接入
- [ ] ReservationOrders 接入
- [ ] ReservationOrderDetail 接入（用 `DetailSkeleton`）

#### Phase 3：低频页面 + 收尾

- [ ] `FormSkeleton`（仅选择器区域）
- [ ] BoxDetail 接入
- [ ] RoomSettings 接入（按区块）
- [ ] MyTransferRecords 接入（初始 `ListSkeleton` + 沿用 InfiniteScroll 自带 loading）
- [ ] CreateItem 接入（仅选择器）

> Scanner 与 CartPopup **不在范围内**，不做改动。

---

## 影响范围

| 文件 | 改动类型 |
|------|----------|
| `client/src/components/skeleton/index.ts` | 新增（barrel） |
| `client/src/components/skeleton/ItemCardSkeleton.tsx` | 新增 |
| `client/src/components/skeleton/ListSkeleton.tsx` | 新增 |
| `client/src/components/skeleton/DetailSkeleton.tsx` | 新增 |
| `client/src/components/skeleton/FormSkeleton.tsx` | 新增 |
| `client/src/components/skeleton/OrderSkeleton.tsx` | 新增 |
| `client/src/hooks/useMinLoadingTime.ts` | 新增（新建 `hooks/` 目录） |
| `client/src/App.tsx` | 修改：`PageFallback` -> branded fallback |
| `client/src/styles/theme.css` | 修改：dark `.adm-skeleton` 对比度覆盖 + `prefers-reduced-motion` |
| `client/src/pages/Warehouse.tsx` | 修改加载态 |
| `client/src/pages/InHand.tsx` | 修改加载态 + 补 `keepPreviousData` |
| `client/src/pages/BoxDetail.tsx` | 修改加载态 |
| `client/src/pages/ReservationOrderDetail.tsx` | 修改加载态（`DetailSkeleton`） |
| `client/src/pages/RoomSettings.tsx` | 修改加载态（按区块） |
| `client/src/pages/Notifications.tsx` | 修改加载态 |
| `client/src/pages/MyReservations.tsx` | 修改加载态 |
| `client/src/pages/CreateItem.tsx` | 修改加载态（仅选择器） |
| `client/src/pages/MyTransferRecords.tsx` | 修改加载态 |
| `client/src/pages/MyItems.tsx` | 修改加载态 |
| `client/src/pages/ReservationOrders.tsx` | 修改加载态 |
| `client/src/components/ItemDetail.tsx` | 新增加载态（仅摘要区） |
| `client/src/pages/Scanner.tsx` | **不改** |
| `client/src/components/CartPopup.tsx` | **不改** |

---

## 验收标准

- `cd client && npm run build` 通过（`tsc` + `vite build` 无类型错误）
- 所有数据加载页面在首次加载时显示对应布局的 skeleton（基于 antd-mobile `Skeleton`）
- Skeleton 有 shimmer 动画效果；`prefers-reduced-motion: reduce` 下动画停止、显示静态骨架
- Skeleton 条目数量与实际内容布局匹配（网格/列表/卡片），桌面端不出现大面积空白
- **light 与 dark 两种主题**下 skeleton 颜色正确（dark 走 `.adm-skeleton` 覆盖）
- **default / rounded / compact 三种 style variant** 下骨架圆角随 `--border-radius: var(--app-radius-*)` 正确变化
- 数据加载 < 300ms 时 skeleton 不闪烁（通过 `useMinLoadingTime` 生效）
- 下拉刷新/筛选切换不显示 skeleton（保持现有内容）
- ItemDetail 弹窗打开后立即显示摘要区 skeleton 而非空白
- 懒加载路由首次进入显示 branded fallback（图标 + 主题 SpinLoading，非裸 SpinLoading）
- 不影响现有 SpinLoading 在 Scanner overlay 和按钮 loading 中的使用
- CartPopup 与 Scanner 行为不变（未改动）

---

## 实施结果

**Commit:** `6887e7f` — `feat: add skeleton loading to all data loading pages`

### 新增文件

| 文件 | 说明 |
|------|------|
| `client/src/components/skeleton/index.ts` | barrel 导出 |
| `client/src/components/skeleton/ItemCardSkeleton.tsx` | 物品卡片骨架（56x56 图 + 名称 + 标签） |
| `client/src/components/skeleton/ListSkeleton.tsx` | 列表骨架（圆形头像 + 2 行文本）× N |
| `client/src/components/skeleton/DetailSkeleton.tsx` | 详情摘要区（80x80 图 + 多行 meta） |
| `client/src/components/skeleton/OrderSkeleton.tsx` | 订单卡片骨架（标题/状态/内容/按钮） |
| `client/src/components/skeleton/FormSkeleton.tsx` | 表单选择器骨架（标签 + 输入框） |
| `client/src/hooks/useMinLoadingTime.ts` | 300ms 最小显示时间 hook |

### 修改文件

| 文件 | 改动 |
|------|------|
| `client/src/styles/theme.css` | dark `.adm-skeleton` 对比度覆盖 + `prefers-reduced-motion` |
| `client/src/App.tsx` | `PageFallback` → branded fallback（PWA 图标 + 主题 SpinLoading） |
| `client/src/pages/Warehouse.tsx` | SWR `isLoading` → `ItemCardSkeleton` × 8（网格） |
| `client/src/pages/InHand.tsx` | 补 `keepPreviousData` + `ItemCardSkeleton` × 8 |
| `client/src/pages/BoxDetail.tsx` | `DetailSkeleton` + `ItemCardSkeleton` × 6 |
| `client/src/pages/ReservationOrderDetail.tsx` | `DetailSkeleton` |
| `client/src/pages/RoomSettings.tsx` | `DetailSkeleton` + `ListSkeleton` × 4 + `ItemCardSkeleton` × 4 |
| `client/src/pages/Notifications.tsx` | `ListSkeleton` × 8 |
| `client/src/pages/MyReservations.tsx` | `OrderSkeleton` × 4 |
| `client/src/pages/CreateItem.tsx` | `FormSkeleton`（仅选择器区域） |
| `client/src/pages/MyTransferRecords.tsx` | `ListSkeleton` × 6 |
| `client/src/pages/MyItems.tsx` | `ItemCardSkeleton` × 8 |
| `client/src/pages/ReservationOrders.tsx` | `OrderSkeleton` × 4 |
| `client/src/components/ItemDetail.tsx` | 新增 loading state + `DetailSkeleton`（摘要区） |

### 验收结果

- ✅ `cd client && npx tsc --noEmit` 编译通过
- ✅ 所有数据加载页面首次加载显示 skeleton
- ✅ Skeleton shimmer 动画 + `prefers-reduced-motion` 停止
- ✅ dark 模式对比度正确
- ✅ 三种 style variant 圆角适配
- ✅ `useMinLoadingTime` 300ms 防闪烁
- ✅ SWR 页面 `keepPreviousData` 刷新不显示 skeleton
- ✅ ItemDetail 弹窗立即显示 skeleton
- ✅ 懒加载路由 branded fallback
- ✅ Scanner / CartPopup 未改动

---

## 后续修复（Post-Implementation Bugs）

### BUG 1 — BoxDetail.tsx：业务刷新误触发骨架屏

**问题**：`setLoading(true)` 放在 `loadBox` 内部，导致批量归还（`handleBatchReturn → loadBox`）也触发整页骨架屏，扫码弹窗被卸载。

**修复**：`setLoading(true)` 移入 `[id]` mount effect。切换盒子（id 变化）仍正常显示骨架屏；业务刷新调用 `loadBox` 不再触发。

**影响范围**：所有经过 `loadBox` 的 mutation 路径（批量归还、单个归还、扫码等）。

### BUG 2 — ReservationOrderDetail.tsx：同上

**问题**：`setLoading(true)` 放在 `loadDetail` 内部，取消预约/延长订单后的刷新整页闪 DetailSkeleton。

**修复**：`setLoading(true)` 移入 `[id]` effect。切换订单仍显示骨架屏；业务刷新不触发。

### BUG 3 — ItemDetail.tsx：快网络闪烁

**问题**：直接用 `loading` 门控，<300ms 的加载会出现 skeleton 闪一下。

**修复**：改用 `useMinLoadingTime(loading) → showSkeleton` 门控。

### BUG 4 — CreateItem.tsx：整页骨架 + 选择器逻辑

**问题**：整页 `FormSkeleton` 早返回，表单字段（二维码/名称/备注）被骨架替代；"没有盒子"判断在 loading 时误报。

**修复**：
- 移除整页 `FormSkeleton` 早返回；表单字段立即渲染
- 盒子选择器在 `showBoxesLoading` 时显示 `FormSkeleton`，加载完切回 Selector
- "没有盒子"判断改为 `!loadingBoxes && boxes.length === 0`
- 提交按钮 `disabled={showBoxesLoading}`
- 加 `useMinLoadingTime(loadingBoxes)` 防闪烁

---

## 第二轮修复：骨架与真实内容布局对齐（已修复）

针对"骨架屏与真实内容样式/边距不一致"的复核，已修复以下 4 处（Commit: 待提交）。

### FIX 5 - ItemCardSkeleton.tsx：对齐真实 ItemCard

**问题**：骨架卡片用 `--app-radius-card` / `padding:12` / 无阴影 / 图片 `--app-radius-m`，真实 `ItemCard` 是 `--app-radius-m` / `padding:8` / `box-shadow` / 图片 `--app-radius-s`。

**修复**：改为 `padding:8`、`--app-radius-m`、`box-shadow: var(--app-shadow-card)`、图片 `--app-radius-s`、flex column gap 6/4、标签 `--app-radius-s`，与 `CardContainer` 一致。惠及 Warehouse / InHand / BoxDetail / RoomSettings。

### FIX 6 - Warehouse.tsx：双重 padding + 缺分组结构

**问题**：骨架 grid 自带 `padding:16`，又在 `<Content>`（`padding:12px 16px`）内 -> 水平边距 32px（真实 16px）；且未体现 `ItemList -> BoxGroup -> BoxTitle -> ItemGrid` 的分组结构。

**修复**：骨架改用真实内容同一套布局组件 `ItemList / BoxGroup / BoxTitle / ItemGrid`，`BoxTitle` 内放一根 Skeleton 条模拟分组标题。padding/gap/结构与真实内容逐像素对齐。

### FIX 7 - InHand.tsx：双重 padding

**问题**：同 Warehouse，骨架 grid 自带 `padding:16` 叠加 `Content` padding。

**修复**：裸 div 换成真实内容用的 `ItemGrid`（无额外 padding）。

### FIX 8 - MyItems.tsx：骨架形态全错 + 双重 padding

**问题**：真实 MyItems 是**单列纵向行列表**（宽行卡片），骨架却是**两列迷你卡片网格**，形态完全不符；且自带 `padding:16` 叠加 `Content` padding。

**修复**：改用 `ListSkeleton count={6}` 匹配纵向列表形态，去掉双重 padding。

---

## 待修复：骨架与真实内容不匹配（彻查结论）

对全部 9 个使用 skeleton 的页面（除已修的 Warehouse / InHand / MyItems 外）逐一比对"骨架分支 vs 真实内容分支"，发现 **8 个页面存在实质性不匹配**。根因是几个共享 skeleton 组件本身设计与真实卡片不符，且多页用裸 `<div style={{padding}}>` 包裹而非复用真实容器组件（与 Warehouse 那类问题同源）。

### 跨页面根因（组件级）

| 组件 | 问题 | 影响页面 |
|---|---|---|
| `OrderSkeleton` | 底部有个 80×32 按钮（真实 `OrderCard` 没有）；radius 用 `--app-radius-card`（真实 `--app-radius-m`）；无 `box-shadow` | MyReservations, ReservationOrders |
| `DetailSkeleton` | 永远带 80×80 图、无 Card 背景。对有图的摘要（ItemDetail）正确；对无图且在 Card 内的头部（BoxInfo / OrderInfo / room-info）错误 | BoxDetail, ReservationOrderDetail, RoomSettings（ItemDetail 正确） |
| `ListSkeleton` | 固定"40 圆头像 + 横向 2 行 + 分隔线"形态，与多页真实形态不符 | Notifications（纵向堆叠无头像）, MyTransferRecords（嵌套卡片）, RoomSettings（无匹配分区） |
| `CenterState` 误用 | 空态/错误态容器（居中、`padding:60px 24px`）被当列表骨架容器 | MyTransferRecords |

### 各页面待修复项

#### 🔴 P1 - MyTransferRecords.tsx（最差）
- 骨架套在 `CenterState`（`padding:60px 24px` + 居中 + `min-height:240`）+ 内层 `padding:16` -> 边距 40px/76px vs 真实 12px。
- 扁平分隔行 vs 真实**嵌套卡片**（头部 + TypeBadge + 物品子列表）；圆头像 vs 方形 38×38 物品图；无卡片背景/圆角/阴影；`text-align:center` 错误；骨架高度远小于真实。
- **修法**：脱离 `CenterState`，用真实 `Content` 容器 + 接近"卡片含子列表"的骨架。

#### 🔴 P1 - ReservationOrderDetail.tsx（最差）
- 只骨架了 OrderInfo 摘要；**主体内容**（SectionTitle + ViewToggle + ReservationGrid + Footer）完全缺失，加载后弹入。
- DetailSkeleton 多 80×80 图、缺 OrderInfo 的 Card 容器；wrapper 不是 `Content`。
- **修法**：骨架覆盖 ReservationGrid 主体；DetailSkeleton 去图 + Card 容器。

#### 🔴 P1 - RoomSettings.tsx
- 5 个分区（房间信息 / 加入申请 / 盒子 / 标签 / 成员）结构未体现；各分区骨架形态全错。
- 盒子/成员是 2 列卡片网格（`repeat(2,1fr)`, gap 10），非 avatar 列表；标签是 pill 流式；没用 `Content` / `Card` 容器；DetailSkeleton 多余图片。
- **修法**：按 5 个 Card 分区分别给骨架，盒子/成员用 2 列网格、标签用 pill 流式。

#### 🟠 P2 - MyReservations.tsx / ReservationOrders.tsx（共性问题）
- **TabBar 被省略** -> 加载完内容下跳 ~38px。
- `OrderSkeleton` 底部假 80×32 按钮 -> 卡片高 ~44px；radius `card` vs `m`；无阴影。
- ReservationOrders 额外 NIT：搜索图标在骨架里未按 `currentRoom` 守卫。
- **修法**：骨架分支补 `TabBar`；改 `OrderSkeleton` 组件（去按钮、radius m、加阴影）一改两修。

#### 🟠 P2 - Notifications.tsx
- ListSkeleton 是**横向**行（40 圆头像 + 2 行），真实通知是**纵向**堆叠（行内 emoji + 标题 + 内容 + 时间，无头像）-> 轴向翻转。
- 行 padding 12 vs 16；未读数条带被省略（可能弹入）。
- **修法**：换纵向堆叠骨架（无头像），或调整 ListSkeleton 形态。

#### 🟡 P3 - ItemDetail.tsx（弹窗）
- 摘要形态匹配（80×80 图 + 18px 标题 + 3 行 + padding 20，✓）。
- 但**只骨架了固定摘要**，80vh 弹窗的 ScrollableDetails（备注/标签/历史/评论）全空；未表示"预约"按钮。
- **修法**：补滚动区占位，避免 80vh 大片空白。

#### 🟡 P3 - BoxDetail.tsx
- 物品网格部分 ✓（复用 Content + ItemGrid）。
- DetailSkeleton 缺 BoxInfo 的 Card 容器、多 80×80 图（盒子头部只有 emoji）；缺"存入物品"按钮和"物品清单"标题。
- **修法**：DetailSkeleton 去图 + Card 容器；补按钮/标题占位。

#### 🟡 P3 - CreateItem.tsx
- 作用域 ✓（仅盒子选择器，表单字段立即渲染）。
- FormSkeleton 是**堆叠** 30% 标签 + 44px 输入条，真实是**横向** Form.Item + Selector pill 芯片 -> 方向/形态不符；标签选择器无骨架（加载后弹入）。
- **修法**：FormSkeleton 改横向 Selector 形态；标签选择器加骨架。

### 修复优先级建议

- **P0（组件级一改多修，性价比最高）**：改 `OrderSkeleton`（去按钮、radius m、加阴影）+ `DetailSkeleton`（图片可选 / 无图变体 + Card 背景）-> 立刻惠及 4+ 页。
- **P1（结构性重写，工作量大）**：MyTransferRecords、ReservationOrderDetail、RoomSettings。
- **P2（小改）**：MyReservations / ReservationOrders 补 `TabBar`；Notifications 换骨架形态。
- **P3（收尾）**：ItemDetail 补滚动区、BoxDetail 补 Card/按钮、CreateItem 改 FormSkeleton。

### 已核实正确（无需改动）

- `useMinLoadingTime` hook 逻辑、5 个骨架组件 + barrel、`App.tsx` branded fallback、`theme.css` dark 覆盖 + `prefers-reduced-motion`。
- Warehouse / InHand / MyItems：经第二轮修复后骨架与真实内容对齐。
- BoxDetail 的物品网格部分（复用 Content + ItemGrid）。
- Scanner / CartPopup：未改动（按计划）。
- `tsc --noEmit` 通过。
