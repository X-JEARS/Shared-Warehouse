# Skeleton Loading 实现方案

**Date:** 2026-07-21
**Status:** 待实现
**Priority:** MEDIUM（用户体验优化）

---

## 背景

当前所有页面均无 skeleton loading，数据加载时仅显示 `SpinLoading` 居中旋转器或直接空白。需要为所有数据加载页面添加骨架屏，提升感知性能。

---

## 现状分析

### 数据加载方式分布

| 方式 | 页面 |
|------|------|
| SWR (`useSWR`) | Warehouse, InHand, MainLayout |
| `useEffect` + 直接 API 调用 | BoxDetail, ReservationOrderDetail, RoomSettings, Scanner, Notifications, MyReservations, CreateItem, MyTransferRecords, MyItems, ReservationOrders, ItemDetail |
| Zustand store（无异步加载） | Profile, SystemSettings, MyProfile |
| 纯表单提交（无初始加载） | Login, Register, CreateRoom, JoinRoom, AddBox |

### 现有加载状态

- 大部分页面：`<SpinLoading />` 居中 + padding
- Scanner：全屏 overlay
- CreateItem：纯文本 "加载中..."
- ItemDetail：无任何加载态（空白 popup）
- 表单页：按钮 loading prop

### 核心问题

1. **无 skeleton**：所有页面用 SpinLoading，布局跳动大
2. **不统一**：每个页面各自实现，无复用组件
3. **体验差**：ItemDetail 弹窗打开后空白 300ms 才出现内容

---

## 修复方案

### 1. 创建通用 Skeleton 组件

```
client/src/components/skeleton/
├── Skeleton.tsx          # 基础骨架单元（矩形/圆形/文本行）
├── SkeletonBlock.tsx     # 组合块（卡片/列表项/表单）
└── skeletons/
    ├── ItemCardSkeleton.tsx      # 物品卡片骨架
    ├── ListSkeleton.tsx          # 通用列表骨架
    ├── DetailSkeleton.tsx        # 详情页骨架
    ├── FormSkeleton.tsx          # 表单页骨架
    └── OrderSkeleton.tsx         # 订单卡片骨架
```

#### `Skeleton.tsx` — 基础单元

```tsx
import styled, { keyframes } from 'styled-components';

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

export const SkeletonBase = styled.div<{ $width?: string; $height?: string; $radius?: string }>`
  width: ${p => p.$width || '100%'};
  height: ${p => p.$height || '16px'};
  border-radius: ${p => p.$radius || 'var(--app-radius-s)'};
  background: linear-gradient(90deg, var(--app-color-skeleton) 25%, var(--app-color-skeleton-highlight) 50%, var(--app-color-skeleton) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
`;

export const SkeletonText = styled(SkeletonBase)<{ $lines?: number }>`;
export const SkeletonCircle = styled(SkeletonBase)`
  border-radius: 50%;
`;
export const SkeletonRect = styled(SkeletonBase)``;
```

#### `SkeletonBlock.tsx` — 组合块

```tsx
// 物品卡片骨架（网格布局）
export function ItemCardSkeleton() {
  return (
    <SkeletonContainer>
      <SkeletonRect $width="56px" $height="56px" />
      <div style={{ flex: 1 }}>
        <SkeletonText $width="70%" $height="14px" />
        <SkeletonText $width="40%" $height="12px" style={{ marginTop: 6 }} />
      </div>
    </SkeletonContainer>
  );
}

// 列表项骨架
export function ListItemSkeleton() {
  return (
    <SkeletonContainer>
      <SkeletonCircle $width="40px" $height="40px" />
      <div style={{ flex: 1 }}>
        <SkeletonText $width="60%" $height="14px" />
        <SkeletonText $width="30%" $height="12px" style={{ marginTop: 6 }} />
      </div>
    </SkeletonContainer>
  );
}
```

### 2. 各页面 Skeleton 映射

| 页面 | 现有加载 | Skeleton 方案 |
|------|----------|---------------|
| **Warehouse** | SpinLoading 居中 | 物品网格用 `ItemCardSkeleton` × 6；分组标题用 `SkeletonText` |
| **InHand** | SpinLoading 居中 | `ItemCardSkeleton` × 6（网格） |
| **BoxDetail** | SpinLoading + overlay | 盒子信息用 `DetailSkeleton`；物品列表用 `ItemCardSkeleton` |
| **ReservationOrderDetail** | SpinLoading 居中 | `OrderSkeleton`（单卡片） |
| **RoomSettings** | SpinLoading 居中 | 多 Tab 各用对应骨架：成员列表 `ListItemSkeleton`，盒子列表 `ItemCardSkeleton`，标签用 `SkeletonText` |
| **Scanner** | 全屏 overlay | 保持 overlay 但内部用 `ItemCardSkeleton` |
| **Notifications** | SpinLoading 居中 | `ListItemSkeleton` × 8 |
| **MyReservations** | SpinLoading 居中 | `OrderSkeleton` × 4 |
| **CreateItem** | 纯文本 | 表单字段用 `FormSkeleton` |
| **MyTransferRecords** | SpinLoading in CenterState | `ListItemSkeleton` × 6 + InfiniteScroll 底部小骨架 |
| **MyItems** | SpinLoading 居中 | `ItemCardSkeleton` × 6 |
| **ReservationOrders** | SpinLoading 居中 | `OrderSkeleton` × 4 |
| **ItemDetail** | 无（空白弹窗） | `DetailSkeleton`（图片+文本行+标签） |
| **CartPopup** | Button loading | 列表部分用 `ItemCardSkeleton` × 3 |
| **MainLayout** | 无 | 底部 tab 数字 badge 无需 skeleton（数据来自 SWR，首次可显示 0） |

### 3. 实现规则

#### 统一行为

- **SWR 页面**：利用 `isLoading` 和 `isValidating` 区分首次加载（skeleton）和后续刷新（keepPreviousData + 不显示 skeleton）
- **useEffect 页面**：用 `loading` state 控制，`true` 时渲染 skeleton，`false` 时渲染内容
- **最小显示时间**：skeleton 至少显示 300ms，避免闪烁（数据 < 300ms 返回时延长到 300ms）
- **数量**：skeleton 条目数固定为 6 条（或根据一屏可见数量调整）

#### CSS 变量

在 `styles/theme` 或全局 CSS 中新增：

```css
--app-color-skeleton: var(--app-color-surface-weak, #f0f0f0);
--app-color-skeleton-highlight: var(--app-color-surface, #fafafa);
```

暗色主题下：

```css
--app-color-skeleton: rgba(255, 255, 255, 0.08);
--app-color-skeleton-highlight: rgba(255, 255, 255, 0.15);
```

#### 与 SpinLoading 的关系

- **页面级首次加载** → Skeleton
- **下拉刷新 / 筛选切换** → 保持现有内容 + 顶部细线加载指示（或保持 SpinLoading）
- **按钮操作** → 保持 Button `loading` prop
- **Scanner 扫码** → 保持全屏 overlay

### 4. 分阶段实施

#### Phase 1：基础组件 + 高频页面

- [ ] `Skeleton.tsx` 基础单元
- [ ] `ItemCardSkeleton`（物品卡片骨架）
- [ ] `ListItemSkeleton`（列表项骨架）
- [ ] Warehouse 页面接入
- [ ] InHand 页面接入
- [ ] ItemDetail 弹窗接入

#### Phase 2：中频页面

- [ ] `OrderSkeleton`（订单卡片骨架）
- [ ] `DetailSkeleton`（详情页骨架）
- [ ] Notifications 页面接入
- [ ] MyReservations 页面接入
- [ ] MyItems 页面接入
- [ ] ReservationOrders 页面接入
- [ ] ReservationOrderDetail 页面接入

#### Phase 3：低频页面 + 收尾

- [ ] `FormSkeleton`（表单骨架）
- [ ] BoxDetail 页面接入
- [ ] RoomSettings 页面接入
- [ ] MyTransferRecords 页面接入
- [ ] CreateItem 页面接入
- [ ] Scanner 页面接入
- [ ] CartPopup 接入

---

## 影响范围

| 文件 | 改动类型 |
|------|----------|
| `client/src/components/skeleton/Skeleton.tsx` | 新增 |
| `client/src/components/skeleton/SkeletonBlock.tsx` | 新增 |
| `client/src/components/skeleton/skeletons/*.tsx` | 新增 |
| `client/src/pages/Warehouse.tsx` | 修改加载态 |
| `client/src/pages/InHand.tsx` | 修改加载态 |
| `client/src/pages/BoxDetail.tsx` | 修改加载态 |
| `client/src/pages/ReservationOrderDetail.tsx` | 修改加载态 |
| `client/src/pages/RoomSettings.tsx` | 修改加载态 |
| `client/src/pages/Scanner.tsx` | 修改加载态 |
| `client/src/pages/Notifications.tsx` | 修改加载态 |
| `client/src/pages/MyReservations.tsx` | 修改加载态 |
| `client/src/pages/CreateItem.tsx` | 修改加载态 |
| `client/src/pages/MyTransferRecords.tsx` | 修改加载态 |
| `client/src/pages/MyItems.tsx` | 修改加载态 |
| `client/src/pages/ReservationOrders.tsx` | 修改加载态 |
| `client/src/components/ItemDetail.tsx` | 新增加载态 |
| `client/src/components/CartPopup.tsx` | 修改加载态 |
| `client/src/styles/theme.css` | 新增 skeleton CSS 变量 |

---

## 验收标准

- 所有数据加载页面在首次加载时显示对应布局的 skeleton
- Skeleton 有 shimmer 动画效果
- Skeleton 条目数量与实际内容布局匹配（网格/列表/卡片）
- 暗色主题下 skeleton 颜色正确
- 数据加载 < 300ms 时 skeleton 不闪烁（最小显示时间）
- 下拉刷新/筛选切换不显示 skeleton（保持现有内容）
- ItemDetail 弹窗打开后立即显示 skeleton 而非空白
- 不影响现有 SpinLoading 在 Scanner overlay 和按钮 loading 中的使用
