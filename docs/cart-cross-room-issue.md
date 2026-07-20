# 购物车跨仓库问题分析与修复方案

**Date:** 2026-07-20
**Status:** Open - 待实现
**Priority:** HIGH（业务逻辑缺陷，影响数据完整性）

> **2026-07-20 修订**：原方案误将死代码 `cartController.ts` 当作真实购物车后端，已重新定位根因到 `reservationController.createOrder`。最终决策：购物车按"当前浏览仓"隔离 + 外来物品可预约 + 后端 `createOrder` 加下单仓成员校验。

---

## 决策摘要（实现须遵循）

1. **购物车按"当前浏览仓"隔离**：每个仓库一个独立购物车，切换仓库只切换视图，**不清空、不弹提示**。
2. **外来物品可预约**：外来物品（归属他仓、当前在本仓）的「+」按钮保持可用，归入当前浏览仓的购物车。
3. **后端轻量校验**：`reservationController.createOrder` 增加校验——客户端传 `roomId`，服务端校验用户是该仓成员。**不校验物品归属仓/当前仓是否等于 roomId**（物品访问由现有 `hasItemAccess` 把关，跨浏览仓混单由前端按浏览仓隔离阻止）。
4. **`cartController.ts` 是死代码**，不在本次范围（建议另开 PR 清理）。

> **关于分组口径**：购物车最终按"当前浏览仓"分组。本仓物品的归属仓 = 当前浏览仓；外来物品按决策 2 也归入当前浏览仓。因此统一以 `currentRoom.room_id` 作为购物车 `roomId`，无需区分本仓/外来。外来物品产生的订单按其归属仓（"应归还仓库"）出现在对方仓的订单列表（`getRoomOrders` 现有行为），与外来物品的核心定义一致。
>
> **结算与订单归属**：用户是否为物品"归属仓"成员不影响结算--只要其是下单仓成员、`hasItemAccess` 通过即可。订单列表按物品归属仓（"应归还仓库"）展示，外来物品订单出现在其归属仓列表；用户在"我的预约"中始终可见。

---

## 问题描述

购物车系统存在跨仓库（room）混单问题：用户可以将不同仓库的物品放入同一个购物车，并在同一个预约单中下单。

### 具体表现

1. 用户在 Room A 浏览，将 Item X 加入购物车
2. 用户切换到 Room B 浏览，将 Item Y 加入购物车
3. 用户进入购物车，看到 Item X 和 Item Y 混在一起
4. 用户下单，系统创建一个包含 Item X 和 Item Y 的预约单
5. 两个不同仓库的物品被同一个预约单绑定

### 业务影响

- 预约单无法关联到单一仓库，管理混乱
- `getRoomOrders`（`reservationController.ts:72`）用 `SELECT DISTINCT` 按物品**归属仓**关联订单，跨仓订单会**同时出现在多个仓的订单列表**（重复出现，而非遗漏）
- 被踢出某个房间后，购物车中该房间的物品仍可下单（前端未提示；后端 `hasItemAccess` 会拦截，但体验差）

---

## 根因分析（已修正）

### 真实链路

- 购物车是**纯客户端**：`client/src/stores/cartStore.ts`（Zustand + localStorage 持久化），与 CLAUDE.md 记载一致。
- 结账链路：`client/src/components/CartPopup.tsx:397` → `reservationApi.createOrder`（`api.ts:146`）→ `server/src/controllers/reservationController.ts:514` `createOrder`。
- **`server/src/controllers/cartController.ts` + `cartApi`（`api.ts:175`）+ `/api/cart` 路由是死代码**：全仓搜索 `cartApi.` 零调用，前端从不访问。原方案修改它无效。

### 真实根因

1. `cartStore.ts:11` 的 `CartItem` 无 `roomId` 字段，无法按仓隔离；`items` 单一数组混存所有仓物品。
2. `client/src/components/ItemCard.tsx:143` `addItem` 不传 `roomId`。
3. `CartPopup.tsx:397` / `Cart.tsx:228` 结账时直接把全量 `items` 提交给 `createOrder`，无仓过滤。
4. `reservationController.createOrder`（514-657）只逐物品做 `hasItemAccess`，**不校验物品是否来自同一浏览仓**。`hasItemAccess`（`server/src/utils/access.ts`）按"归属仓 OR 当前仓"成员身份授权，本就跨仓，无法阻止跨仓下单。

---

## 修复方案

### 后端

#### 1. `reservationController.createOrder` 增加下单仓成员校验（决策 3）

在现有事务内、`hasItemAccess` 循环之后，增加：客户端须传 `roomId`（下单仓）；服务端校验用户是该仓成员。**不校验物品归属仓/当前仓是否等于 roomId**--物品访问由现有 `hasItemAccess` 把关，跨浏览仓混单由前端按浏览仓隔离阻止。不满足则 `ROLLBACK` 返回 403。原有行锁查询（539-548）保持不变。

在 `hasItemAccess` 循环之后追加：

```typescript
const rid = Number(req.body.roomId);
if (!Number.isInteger(rid) || rid <= 0) {
  await client.query('ROLLBACK');
  return error(res, 'roomId is required');
}

// 校验用户是 roomId 成员
const memberCheck = await client.query(
  'SELECT 1 FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
  [rid, userId]
);
if (memberCheck.rows.length === 0) {
  await client.query('ROLLBACK');
  return error(res, 'Access denied', 403);
}
```

> 说明：用户是否为物品"归属仓"成员不影响结算--只要其是下单仓成员且 `hasItemAccess` 通过即可。这是"在哪个仓库下单，就是哪个仓库"的服务端落地；不做物品-仓库关联判断，避免复杂逻辑。

#### 2. `reservationApi.createOrder` 签名加 `roomId`

`client/src/services/api.ts:146`：

```typescript
createOrder: (data: {
  roomId: number;                      // 新增
  title?: string;
  items: Array<{ itemId: number; startTime: number; endTime: number }>;
}) => request.post('/reservations/orders', data),
```

### 前端

#### 3. `cartStore.ts`（决策 1 + 持久化迁移）

- `CartItem` 增加必填字段 `roomId: number`。
- `addItem(item)` 由调用方传入 `roomId`；`addItem` 内部不再推导。
- 新增"当前仓过滤"selector（或在组件内 `items.filter(i => i.roomId === currentRoomId)`）。
- 结账成功后**只移除当前仓的 items**（不全量 `clearCart`）；`startTime/endTime/orderTitle` 保留至手动清空或全部购物车为空。
- 手动「清空」按钮仍走全量 `clearCart`。
- persist `version` 1 → 2；`migrate` 丢弃无 `roomId` 的旧 items（旧购物车无 roomId 无法重建，且购物车为临时数据，静默丢弃可接受）：

```typescript
{
  name: 'cart-storage',
  version: 2,
  migrate: (persistedState: any) => {
    const state = persistedState as CartState;
    return {
      ...state,
      items: (state.items || []).filter((i) => i.roomId != null),
    };
  },
}
```

#### 4. `ItemCard.tsx`（决策 2）

- `addItem` 传 `roomId: currentRoom.room_id`（本仓 & 外来物品统一用当前浏览仓）。
- 「+」按钮对外来物品**保持可用**（不禁用）；外来徽标照常显示。
- `isInCart` 维持全局 item 级判断（`items.some(i => i.itemId === item.item_id)`），不按仓区分。

#### 5. `CartPopup.tsx`

- 渲染与结账均使用当前仓过滤后的 items。
- FAB 角标用**当前仓过滤后**数量（`client/src/pages/Warehouse.tsx:193` 的 `cartItemCount` 改为过滤后计数）。
- `createOrder` 传 `roomId: currentRoom.room_id`。
- 结账成功后调用"移除当前仓 items"（见 3），而非全量 `clearCart`。

#### 6. `Warehouse.tsx`（决策 1）

- 切仓只切 `currentRoom`，购物车视图随之过滤。**不清空、不弹提示**。
- FAB 显隐与角标均按当前仓过滤后数量。

#### 7. `Cart.tsx` + `/cart` 路由

- 该页面是**孤儿**（全仓无 `navigate('/cart')`，仅 `App.tsx:101` 与 `MainLayout.tsx:26` 残留路由）。**建议删除** `Cart.tsx` 及其 `/cart` 路由；若保留则同步加当前仓过滤与 `roomId` 传参。

### 不变

- `getRoomOrders`（`reservationController.ts:72`）无需改（已按归属仓关联，修复后正常单仓订单天然归一）。
- `cartController.ts` / `cartApi` / `/api/cart` 死代码，另开 PR 清理。

---

## 影响范围

| 文件 | 改动 |
|---|---|
| `server/src/controllers/reservationController.ts` | `createOrder` 加 `roomId` 下单仓成员校验（不校验物品同仓） |
| `client/src/services/api.ts` | `reservationApi.createOrder` 签名加 `roomId` |
| `client/src/stores/cartStore.ts` | `CartItem` 加 `roomId`；过滤 selector；结账按仓移除；persist v2 迁移 |
| `client/src/components/ItemCard.tsx` | `addItem` 传 `roomId`；外来物品不禁用「+」 |
| `client/src/components/CartPopup.tsx` | 当前仓过滤渲染/结账；FAB 角标按当前仓；传 `roomId` |
| `client/src/pages/Warehouse.tsx` | FAB 角标按当前仓；切仓不清空 |
| `client/src/pages/Cart.tsx` | 建议删除（孤儿页面） |

---

## 边界情况

- **个人盒物品**（`box_belong_room_id IS NULL`）：无加购入口（InHand/MyItems 无「+」按钮），非问题。
- **外来物品订单的列表归属**：外来物品订单按其归属仓（"应归还仓库"）出现在对方仓订单列表（`getRoomOrders` 现有行为），与外来物品的核心定义一致；用户在"我的预约"中始终可见。
- **被踢出仓库**：该仓 items 留在 localStorage 但不可见、不可下单（`currentRoom` 会切走 + `createOrder` 的 `hasItemAccess`/成员校验拦截）。已知限制，不做额外清理。

---

## 验收标准

- 正常使用下，不同浏览仓的物品不会进入同一预约单（前端按浏览仓隔离）。后端校验下单仓成员身份 + 物品访问（`hasItemAccess`），不做物品同仓强制。
- 用户不是物品归属仓成员时，只要其是下单仓成员且 `hasItemAccess` 通过，即可结算。
- 切仓后购物车按仓隔离、互不丢失、不清空、不弹提示。
- 老用户升级后旧购物车被清，无残留孤儿 items。
- 外来物品可加入当前浏览仓购物车并正常结算。
- 后端单测：`createOrder` 对非下单仓成员返回 403；缺少 `roomId` 返回 400。

---

## 不在范围

- `orders` 表加 `order_room_id` 列（当前派生关联已足够，未来若要按仓索引订单可再议）。
- 删除死代码 `cartController` / `cartApi` / `/api/cart` 路由（建议另开 PR）。
