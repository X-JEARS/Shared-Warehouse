# 购物车跨仓库问题分析与修复方案

**Date:** 2026-07-20
**Status:** Open — 待修复
**Priority:** HIGH（业务逻辑缺陷，影响数据完整性）

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

- 预约单无法关联到单一仓库，导致管理混乱
- 按仓库查看订单时会遗漏跨仓库的预约记录
- 被踢出某个房间后，购物车中该房间的物品仍然可以下单（前端未提示）

---

## 根因分析

### 后端问题

**1. 购物车存储不按 room 隔离**

`server/src/controllers/cartController.ts:8`
```typescript
const carts: Map<number, any[]> = new Map();
// Key: userId, Value: Array of { itemId, roomId, startTime, endTime }
```

购物车以 `userId` 为 key，同一用户的所有房间物品混存在一个数组中。

**2. `addToCart` 不校验 roomId**

`server/src/controllers/cartController.ts:54`
```typescript
const { itemId, roomId, startTime, endTime } = req.body;
```

`roomId` 由客户端传入，但服务端只检查用户是否是物品所在房间的成员，不校验 `roomId` 是否与物品实际所属房间一致，也不校验购物车内是否已有其他房间的物品。

**3. `checkout` 不校验 roomId 一致性**

`server/src/controllers/cartController.ts:143-196`

结账时只做了 `hasItemAccess` 权限检查，没有验证所有物品是否属于同一个 room。

### 前端问题

**1. 购物车 Store 不记录 roomId**

`client/src/stores/cartStore.ts:11-21`
```typescript
export interface CartItem {
  itemId: number;
  itemName: string;
  itemQrcode: string;
  itemImage?: string;
  boxName?: string;
  roomName?: string;  // 仅用于展示，不参与逻辑
  // 没有 roomId 字段
}
```

`CartItem` 没有 `roomId` 字段，无法在前端判断物品属于哪个仓库。

**2. 加购物车时不传 roomId**

`client/src/components/ItemCard.tsx:143-150`
```typescript
addItem({
  itemId: item.item_id,
  itemName: displayName,
  itemQrcode: item.item_qrcode || '',
  itemImage: item.item_image,
  boxName: item.box_name,
  roomName: item.room_name,
  // 没有传 roomId
});
```

**3. 结账时不传 roomId**

`client/src/pages/Cart.tsx:228-235` / `client/src/components/CartPopup.tsx:397-404`
```typescript
await reservationApi.createOrder({
  title: orderTitle || defaultTitle,
  items: items.map((item) => ({
    itemId: item.itemId,
    startTime: startTime,
    endTime: endTime,
    // 没有 roomId
  })),
});
```

---

## 修复方案

### 方案：按仓库隔离购物车

每个仓库一个购物车，切换仓库时自动切换购物车上下文。前端展示时只显示当前仓库的物品，结账时只提交当前仓库的物品。

#### 后端改动

**1. 购物车存储结构改为 `Map<userId, Map<roomId, item[]>>`**

```typescript
// cartController.ts
const carts: Map<number, Map<number, any[]>> = new Map();
```

**2. `addToCart` 强制使用服务端 roomId**

```typescript
export const addToCart = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const { itemId, startTime, endTime } = req.body;
  // roomId 不再从 body 取，改为从物品实际归属查询

  // ... 权限检查 ...

  // 获取物品实际所属房间
  const itemRoomId = item.box_belong_room_id;

  // 获取或创建该用户的房间购物车
  if (!carts.has(userId)) carts.set(userId, new Map());
  const userCarts = carts.get(userId)!;

  if (!userCarts.has(itemRoomId)) userCarts.set(itemRoomId, []);
  const roomCart = userCarts.get(itemRoomId)!;

  // 添加到对应房间的购物车
  const existingIndex = roomCart.findIndex((c) => c.itemId === itemId);
  if (existingIndex >= 0) {
    roomCart[existingIndex] = { itemId, roomId: itemRoomId, startTime, endTime };
  } else {
    roomCart.push({ itemId, roomId: itemRoomId, startTime, endTime });
  }

  return success(res, { itemCount: roomCart.length }, 'Added to cart');
};
```

**3. `getCart` 只返回指定 roomId 的购物车**

```typescript
export const getCart = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const { roomId } = req.query; // 必须传 roomId

  const userCarts = carts.get(userId);
  if (!userCarts) return success(res, []);

  const roomCart = userCarts.get(Number(roomId)) || [];
  // ... 返回该房间的物品 ...
};
```

**4. `checkout` 只处理指定 roomId 的购物车**

```typescript
export const checkout = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const { roomId, title } = req.body; // 必须传 roomId

  const userCarts = carts.get(userId);
  if (!userCarts || !userCarts.has(Number(roomId))) {
    return error(res, 'Cart is empty');
  }

  const cart = userCarts.get(Number(roomId))!;
  userCarts.delete(Number(roomId)); // 只删除该房间的购物车

  // ... 权限检查 + 创建预约（所有物品已保证同一房间）...
};
```

#### 前端改动

**1. CartItem 增加 roomId 字段**

```typescript
// cartStore.ts
export interface CartItem {
  itemId: number;
  roomId: number;  // 新增：必须字段
  itemName: string;
  // ...
}
```

**2. 加购物车时传入 roomId**

```typescript
// ItemCard.tsx
addItem({
  itemId: item.item_id,
  roomId: currentRoom.room_id,  // 从当前房间上下文获取
  itemName: displayName,
  // ...
});
```

**3. 购物车页面按 roomId 过滤**

```typescript
// Cart.tsx / CartPopup.tsx
const currentRoomId = /* 从路由或 store 获取当前房间 */;
const cartItems = useCartStore((s) => s.items.filter(i => i.roomId === currentRoomId));
```

**4. 结账时传入 roomId**

```typescript
await reservationApi.createOrder({
  roomId: currentRoomId,  // 新增
  title: orderTitle,
  items: cartItems.map((item) => ({
    itemId: item.itemId,
    startTime: startTime,
    endTime: endTime,
  })),
});
```

**5. 切换仓库时清空购物车提示**

当用户从 Room A 切换到 Room B 时，如果 Room A 购物车还有物品，提示用户"切换仓库将清空当前购物车"。

---

## 影响范围

- `server/src/controllers/cartController.ts` — 全部购物车相关函数
- `client/src/stores/cartStore.ts` — CartItem 接口 + 过滤逻辑
- `client/src/components/ItemCard.tsx` — 加购物车时传 roomId
- `client/src/pages/Cart.tsx` — 结账时传 roomId + 按房间过滤
- `client/src/components/CartPopup.tsx` — 同上
- `client/src/pages/Warehouse.tsx` — 切换仓库时的购物车提示
- `client/src/services/api.ts` — cartApi 接口签名调整

---

## 注意事项

- 现有内存购物车数据不受影响（无持久化，重启即清空）
- 如果未来购物车改为 DB 存储，需要考虑迁移策略
- `reservationApi.createOrder` 已有 `hasItemAccess` 检查，修复后同一房间内的物品权限已有保障
