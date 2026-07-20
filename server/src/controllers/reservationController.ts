import { Request, Response } from 'express';
import { query } from '../config/database';
import pool from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';
import { createNotification } from './notificationController';
import { isRoomAdmin } from '../utils/admin';
import { hasItemAccess } from '../utils/access';

// 获取用户的预约订单列表
export const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { status } = req.query;

    let sql = `
      SELECT
        o.order_id,
        o.order_create_time,
        o.order_title,
        o.order_is_canceled,
        COUNT(r.reservation_id) as total_items,
        COUNT(CASE WHEN r.reservation_is_canceled = false THEN 1 END) as active_items,
        MIN(CASE WHEN r.reservation_is_canceled = false THEN r.reservation_start_time END) as start_time,
        MAX(CASE WHEN r.reservation_is_canceled = false THEN r.reservation_end_time END) as end_time
      FROM orders o
      LEFT JOIN reservations r ON o.order_id = r.reservation_order_id
      WHERE o.order_user_id = $1
    `;
    const values: any[] = [userId];
    let paramCount = 2;

    if (status === 'active') {
      sql += ` AND o.order_is_canceled = false AND r.reservation_is_canceled = false AND r.reservation_end_time > $${paramCount++}`;
      values.push(Date.now());
    } else if (status === 'past') {
      sql += ` AND (o.order_is_canceled = true OR r.reservation_is_canceled = true OR r.reservation_end_time <= $${paramCount++})`;
      values.push(Date.now());
    }

    sql += ' GROUP BY o.order_id ORDER BY o.order_create_time DESC';

    const result = await query(sql, values);

    // 计算每个订单的状态
    const orders = result.rows.map((order: any) => {
      const now = Date.now();
      let orderStatus = 'active';

      if (order.order_is_canceled) {
        orderStatus = 'canceled';
      } else if (order.end_time && order.end_time < now) {
        orderStatus = 'completed';
      } else if (order.start_time && order.start_time > now) {
        orderStatus = 'upcoming';
      }

      return {
        ...order,
        order_status: orderStatus,
      };
    });

    return success(res, orders);
  } catch (err) {
    console.error('Get orders error:', err);
    return error(res, 'Failed to get orders', 500);
  }
};

// 获取仓库所有预约订单列表
export const getRoomOrders = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { roomId } = req.params;
    const { status } = req.query;

    // 验证用户是否是仓库成员
    const memberCheck = await query(
      'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [roomId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return error(res, 'Access denied', 403);
    }

    // 获取仓库所有订单（通过物品所属仓库关联）
    let sql = `
      SELECT DISTINCT
        o.order_id,
        o.order_create_time,
        o.order_title,
        o.order_is_canceled,
        u.user_nickname as order_user_nickname,
        COUNT(r.reservation_id) as total_items,
        COUNT(CASE WHEN r.reservation_is_canceled = false THEN 1 END) as active_items,
        MIN(CASE WHEN r.reservation_is_canceled = false THEN r.reservation_start_time END) as start_time,
        MAX(CASE WHEN r.reservation_is_canceled = false THEN r.reservation_end_time END) as end_time
      FROM orders o
      JOIN reservations r ON o.order_id = r.reservation_order_id
      JOIN items i ON r.reservation_item_id = i.item_id
      JOIN boxes b ON i.item_belong_box_id = b.box_id
      JOIN users u ON o.order_user_id = u.user_id
      WHERE b.box_belong_room_id = $1
    `;
    const values: any[] = [roomId];
    let paramCount = 2;

    if (status === 'active') {
      sql += ` AND o.order_is_canceled = false AND r.reservation_is_canceled = false AND r.reservation_end_time > $${paramCount++}`;
      values.push(Date.now());
    } else if (status === 'past') {
      sql += ` AND (o.order_is_canceled = true OR r.reservation_is_canceled = true OR r.reservation_end_time <= $${paramCount++})`;
      values.push(Date.now());
    }

    sql += ' GROUP BY o.order_id, u.user_nickname ORDER BY o.order_create_time DESC';

    const result = await query(sql, values);

    // 计算每个订单的状态
    const orders = result.rows.map((order: any) => {
      const now = Date.now();
      let orderStatus = 'active';

      if (order.order_is_canceled) {
        orderStatus = 'canceled';
      } else if (order.end_time && order.end_time < now) {
        orderStatus = 'completed';
      } else if (order.start_time && order.start_time > now) {
        orderStatus = 'upcoming';
      }

      return {
        ...order,
        order_status: orderStatus,
      };
    });

    return success(res, orders);
  } catch (err) {
    console.error('Get room orders error:', err);
    return error(res, 'Failed to get room orders', 500);
  }
};

// 获取当前用户在指定仓库最近创建的 5 个有效预约单，用于扫码取还时核对
export const getRecentRoomOrders = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { roomId } = req.params;

    const memberCheck = await query(
      'SELECT 1 FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [roomId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return error(res, 'Access denied', 403);
    }

    const ordersResult = await query(
      `SELECT
        o.order_id,
        o.order_create_time,
        o.order_title,
        MIN(r.reservation_start_time) AS start_time,
        MAX(r.reservation_end_time) AS end_time,
        COUNT(r.reservation_id) AS room_item_count
       FROM orders o
       JOIN reservations r ON r.reservation_order_id = o.order_id
       JOIN items i ON i.item_id = r.reservation_item_id
       JOIN boxes belong_box ON belong_box.box_id = i.item_belong_box_id
       WHERE o.order_user_id = $1
         AND belong_box.box_belong_room_id = $2
         AND o.order_is_canceled = false
         AND r.reservation_is_canceled = false
       GROUP BY o.order_id
       ORDER BY o.order_create_time DESC
       LIMIT 5`,
      [userId, roomId]
    );

    if (ordersResult.rows.length === 0) {
      return success(res, []);
    }

    const orderIds = ordersResult.rows.map((order: any) => order.order_id);
    const reservationsResult = await query(
      `SELECT
        r.reservation_id,
        r.reservation_order_id,
        r.reservation_item_id,
        r.reservation_start_time,
        r.reservation_end_time,
        i.item_name,
        i.item_qrcode,
        i.item_image,
        current_box.box_id AS current_box_id,
        current_box.box_name AS current_box_name,
        current_box.box_belong_room_id AS current_room_id,
        current_room.room_name AS current_room_name,
        holder.user_id AS holder_user_id,
        holder.user_nickname AS holder_nickname,
        (i.item_current_box_id = viewer_user.user_box_id) AS is_in_user_hand
       FROM reservations r
       JOIN items i ON i.item_id = r.reservation_item_id
       JOIN users viewer_user ON viewer_user.user_id = $1
       LEFT JOIN boxes current_box ON current_box.box_id = i.item_current_box_id
       LEFT JOIN rooms current_room ON current_room.room_id = current_box.box_belong_room_id
       LEFT JOIN users holder ON holder.user_box_id = current_box.box_id
       WHERE r.reservation_order_id = ANY($2::int[])
         AND r.reservation_is_canceled = false
       ORDER BY r.reservation_start_time ASC, r.reservation_id ASC`,
      [userId, orderIds]
    );

    const reservationsByOrder = new Map<number, any[]>();
    for (const reservation of reservationsResult.rows) {
      const reservations = reservationsByOrder.get(reservation.reservation_order_id) || [];
      reservations.push(reservation);
      reservationsByOrder.set(reservation.reservation_order_id, reservations);
    }

    return success(res, ordersResult.rows.map((order: any) => ({
      ...order,
      reservations: reservationsByOrder.get(order.order_id) || [],
    })));
  } catch (err) {
    console.error('Get recent room orders error:', err);
    return error(res, 'Failed to get recent room orders', 500);
  }
};

// 获取订单详情
export const getOrderDetail = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // 获取订单信息（允许订单所有者或仓库成员查看）
    const orderResult = await query(
      `SELECT * FROM orders WHERE order_id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return error(res, 'Order not found', 404);
    }

    const order = orderResult.rows[0];

    // 如果不是订单所有者，需要验证是否是仓库成员
    if (order.order_user_id !== userId) {
      // 获取订单中物品所属的仓库
      const roomCheckResult = await query(
        `SELECT DISTINCT b.box_belong_room_id
         FROM reservations r
         JOIN items i ON r.reservation_item_id = i.item_id
         JOIN boxes b ON i.item_belong_box_id = b.box_id
         WHERE r.reservation_order_id = $1`,
        [id]
      );

      if (roomCheckResult.rows.length === 0) {
        return error(res, 'Order not found', 404);
      }

      // 检查用户是否是任一相关仓库的成员
      const roomIds = roomCheckResult.rows.map((row: any) => row.box_belong_room_id);
      const memberCheck = await query(
        `SELECT 1 FROM room_members
         WHERE member_user_id = $1 AND member_room_id = ANY($2::int[])`,
        [userId, roomIds]
      );

      if (memberCheck.rows.length === 0) {
        return error(res, 'Access denied', 403);
      }
    }

    // 获取订单下的所有预约
    const reservationsResult = await query(
      `SELECT
        r.*,
        i.item_name,
        i.item_qrcode,
        i.item_image,
        b.box_name,
        rm.room_name,
        CASE WHEN b.box_belong_room_id IS NULL THEN true ELSE false END AS is_user_box,
        ub.user_nickname AS holder_nickname,
        ub.user_id AS holder_user_id
      FROM reservations r
      JOIN items i ON r.reservation_item_id = i.item_id
      LEFT JOIN boxes b ON i.item_current_box_id = b.box_id
      LEFT JOIN rooms rm ON b.box_belong_room_id = rm.room_id
      LEFT JOIN users ub ON ub.user_box_id = b.box_id
      WHERE r.reservation_order_id = $1
      ORDER BY r.reservation_start_time ASC`,
      [id]
    );

    return success(res, {
      order,
      reservations: reservationsResult.rows,
    });
  } catch (err) {
    console.error('Get order detail error:', err);
    return error(res, 'Failed to get order detail', 500);
  }
};

// 取消整个订单
export const cancelOrder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // 验证订单所有权
    const orderResult = await query(
      'SELECT * FROM orders WHERE order_id = $1 AND order_user_id = $2',
      [id, userId]
    );

    if (orderResult.rows.length === 0) {
      return error(res, 'Order not found', 404);
    }

    if (orderResult.rows[0].order_is_canceled) {
      return error(res, 'Order already canceled');
    }

    // 取消订单和所有相关的预约
    await query('UPDATE orders SET order_is_canceled = true WHERE order_id = $1', [id]);
    await query(
      'UPDATE reservations SET reservation_is_canceled = true WHERE reservation_order_id = $1',
      [id]
    );

    return success(res, null, 'Order canceled');
  } catch (err) {
    console.error('Cancel order error:', err);
    return error(res, 'Failed to cancel order', 500);
  }
};

export const getReservations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { status } = req.query;

    let sql = `
      SELECT r.*, i.item_name, i.item_qrcode, b.box_name,
        o.order_title, o.order_create_time as order_create_time
      FROM reservations r
      JOIN items i ON r.reservation_item_id = i.item_id
      LEFT JOIN boxes b ON i.item_current_box_id = b.box_id
      LEFT JOIN orders o ON r.reservation_order_id = o.order_id
      WHERE r.reservation_user_id = $1
    `;
    const values: any[] = [userId];
    let paramCount = 2;

    if (status === 'active') {
      sql += ` AND r.reservation_is_canceled = false AND r.reservation_end_time > $${paramCount++}`;
      values.push(Date.now());
    } else if (status === 'past') {
      sql += ` AND (r.reservation_is_canceled = true OR r.reservation_end_time <= $${paramCount++})`;
      values.push(Date.now());
    }

    sql += ' ORDER BY r.reservation_start_time DESC';

    const result = await query(sql, values);

    return success(res, result.rows);
  } catch (err) {
    console.error('Get reservations error:', err);
    return error(res, 'Failed to get reservations', 500);
  }
};

export const createReservation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { itemId, startTime, endTime, orderId } = req.body;

    if (!itemId || !startTime || !endTime) {
      return error(res, 'Item ID, start time, and end time are required');
    }

    if (startTime >= endTime) {
      return error(res, 'End time must be after start time');
    }

    // Use a transaction with row-level locking to prevent TOCTOU race
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (!userId || !await hasItemAccess(userId, Number(itemId), client)) {
        await client.query('ROLLBACK');
        return error(res, 'Access denied', 403);
      }

      // Lock existing reservations for this item to prevent concurrent inserts
      const conflictCheck = await client.query(
        `SELECT * FROM reservations
         WHERE reservation_item_id = $1
           AND reservation_is_canceled = false
           AND (
             (reservation_start_time <= $2 AND reservation_end_time >= $2)
             OR (reservation_start_time <= $3 AND reservation_end_time >= $3)
             OR (reservation_start_time >= $2 AND reservation_end_time <= $3)
           )
         FOR UPDATE`,
        [itemId, startTime, endTime]
      );

      if (conflictCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return error(res, 'This item is already reserved during the selected time period');
      }

      const result = await client.query(
        `INSERT INTO reservations (reservation_item_id, reservation_start_time, reservation_end_time, reservation_user_id, reservation_order_id, reservation_is_canceled)
         VALUES ($1, $2, $3, $4, $5, false)
         RETURNING *`,
        [itemId, startTime, endTime, userId, orderId || null]
      );

      await client.query('COMMIT');
      return success(res, result.rows[0], 'Reservation created', 201);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create reservation error:', err);
      return error(res, 'Failed to create reservation', 500);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create reservation error:', err);
    return error(res, 'Failed to create reservation', 500);
  }
};

export const cancelReservation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // Verify ownership
    const checkResult = await query(
      'SELECT * FROM reservations WHERE reservation_id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return error(res, 'Reservation not found', 404);
    }

    if (checkResult.rows[0].reservation_user_id !== userId) {
      return error(res, 'You can only cancel your own reservations', 403);
    }

    await query(
      'UPDATE reservations SET reservation_is_canceled = true WHERE reservation_id = $1',
      [id]
    );

    return success(res, null, 'Reservation canceled');
  } catch (err) {
    console.error('Cancel reservation error:', err);
    return error(res, 'Failed to cancel reservation', 500);
  }
};

export const getItemReservations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { includePast } = req.query;

    if (!userId || !await hasItemAccess(userId, Number(id))) {
      return error(res, 'Access denied', 403);
    }

    let sql = `
      SELECT r.*, u.user_nickname
      FROM reservations r
      JOIN users u ON r.reservation_user_id = u.user_id
      WHERE r.reservation_item_id = $1 AND r.reservation_is_canceled = false
    `;
    const values: any[] = [id];

    if (!includePast) {
      sql += ' AND r.reservation_end_time > $2';
      values.push(Date.now());
    }

    sql += ' ORDER BY r.reservation_start_time ASC';

    const result = await query(sql, values);

    return success(res, result.rows);
  } catch (err) {
    console.error('Get item reservations error:', err);
    return error(res, 'Failed to get item reservations', 500);
  }
};

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { title, items, roomId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return error(res, 'Items array is required');
    }

    // Use a transaction with row-level locking to prevent TOCTOU race conditions
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock all items upfront to prevent concurrent reservation creation
      const itemIds = items.map(i => Number(i.itemId));
      const uniqueItemIds = [...new Set(itemIds)].sort((a, b) => a - b);
      if (
        itemIds.some(id => !Number.isInteger(id) || id <= 0)
        || uniqueItemIds.length !== itemIds.length
      ) {
        await client.query('ROLLBACK');
        return error(res, 'Invalid or duplicate item IDs');
      }

      const rid = Number(req.body.roomId);
      if (!Number.isInteger(rid) || rid <= 0) {
        await client.query('ROLLBACK');
        return error(res, 'roomId is required');
      }

      if (uniqueItemIds.length > 0) {
        // Lock items first (FOR UPDATE on items table only)
        const lockedItems = await client.query(
          `SELECT item_id FROM items WHERE item_id = ANY($1) FOR UPDATE`,
          [uniqueItemIds]
        );
        if (lockedItems.rows.length !== uniqueItemIds.length) {
          await client.query('ROLLBACK');
          return error(res, 'Item not found', 404);
        }

        // Fetch room info for each item
        const itemRooms = await client.query(
          `SELECT i.item_id,
                  bb.box_belong_room_id AS belong_room_id,
                  cb.box_belong_room_id AS current_room_id
           FROM items i
           JOIN boxes bb ON i.item_belong_box_id = bb.box_id
           LEFT JOIN boxes cb ON i.item_current_box_id = cb.box_id
           WHERE i.item_id = ANY($1)`,
          [uniqueItemIds]
        );

        // Verify user is a member of roomId
        const memberCheck = await client.query(
          'SELECT 1 FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
          [rid, userId]
        );
        if (memberCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return error(res, 'Access denied', 403);
        }

        // Verify all items belong to or are currently in roomId
        for (const row of itemRooms.rows) {
          if (row.belong_room_id !== rid && row.current_room_id !== rid) {
            await client.query('ROLLBACK');
            return error(res, '一个预约单只能包含同一仓库的物品', 400);
          }
        }
      }

      for (const itemId of uniqueItemIds) {
        if (!userId || !await hasItemAccess(userId, itemId, client)) {
          await client.query('ROLLBACK');
          return error(res, 'Access denied', 403);
        }
      }

      // Check all items for conflicts (now safe from concurrent inserts due to locks)
      const conflicts: { itemId: number; itemName?: string }[] = [];

      for (const item of items) {
        const conflictCheck = await client.query(
          `SELECT r.*, i.item_name
           FROM reservations r
           JOIN items i ON r.reservation_item_id = i.item_id
           WHERE r.reservation_item_id = $1
             AND r.reservation_is_canceled = false
             AND (
               (r.reservation_start_time <= $2 AND r.reservation_end_time >= $2)
               OR (r.reservation_start_time <= $3 AND r.reservation_end_time >= $3)
               OR (r.reservation_start_time >= $2 AND r.reservation_end_time <= $3)
             )`,
          [item.itemId, item.startTime, item.endTime]
        );

        if (conflictCheck.rows.length > 0) {
          conflicts.push({
            itemId: item.itemId,
            itemName: conflictCheck.rows[0].item_name,
          });
        }
      }

      // If there are any conflicts, return error without creating any reservations
      if (conflicts.length > 0) {
        await client.query('ROLLBACK');
        return error(res, `以下物品在所选时间已被预约：${conflicts.map(c => c.itemName || `物品${c.itemId}`).join('、')}`);
      }

      const createTime = Date.now();

      // Create order
      const orderResult = await client.query(
        `INSERT INTO orders (order_create_time, order_user_id, order_title, order_is_canceled)
         VALUES ($1, $2, $3, false)
         RETURNING *`,
        [createTime, userId, title || null]
      );

      const order = orderResult.rows[0];

      // Create reservations for each item
      const reservations = [];
      const itemNames: string[] = [];

      for (const item of items) {
        const result = await client.query(
          `INSERT INTO reservations (reservation_item_id, reservation_start_time, reservation_end_time, reservation_user_id, reservation_order_id, reservation_is_canceled)
           VALUES ($1, $2, $3, $4, $5, false)
           RETURNING *`,
          [item.itemId, item.startTime, item.endTime, userId, order.order_id]
        );

        reservations.push(result.rows[0]);

        // 获取物品名称
        const itemResult = await client.query('SELECT item_name FROM items WHERE item_id = $1', [item.itemId]);
        if (itemResult.rows.length > 0) {
          itemNames.push(itemResult.rows[0].item_name);
        }
      }

      await client.query('COMMIT');

      // 创建预约成功通知
      const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      };

      // 获取最小开始时间和最大结束时间
      const startTime = Math.min(...items.map(i => i.startTime));
      const endTime = Math.max(...items.map(i => i.endTime));
      const timeStr = `${formatDate(startTime)} 至 ${formatDate(endTime)}`;
      const content = `预约时间：${timeStr}\n预约器材：${itemNames.join('、')}`;

      if (userId) {
        await createNotification(
          userId,
          'reservation',
          '预约成功',
          content,
          order.order_id
        );
      }

      return success(res, { order, reservations }, 'Order created', 201);
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create order error:', err);
    return error(res, 'Failed to create order', 500);
  }
};

export const getTags = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { roomId } = req.params;

    // Verify membership
    const memberCheck = await query(
      'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [roomId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return error(res, 'Access denied', 403);
    }

    const result = await query(
      'SELECT * FROM tags WHERE tag_belong_room_id = $1 ORDER BY tag_name',
      [roomId]
    );

    return success(res, result.rows);
  } catch (err) {
    console.error('Get tags error:', err);
    return error(res, 'Failed to get tags', 500);
  }
};

export const createTag = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { roomId } = req.params;
    const { name } = req.body;

    if (!name) {
      return error(res, 'Tag name is required');
    }

    if (name.length > 12) {
      return error(res, 'Tag name must be 12 characters or less');
    }

    if (!(await isRoomAdmin(parseInt(roomId), userId))) {
      return error(res, 'Only admin can create tags', 403);
    }

    // Check for duplicate
    const dupCheck = await query(
      'SELECT * FROM tags WHERE tag_belong_room_id = $1 AND tag_name = $2',
      [roomId, name]
    );

    if (dupCheck.rows.length > 0) {
      return error(res, 'Tag already exists');
    }

    const result = await query(
      `INSERT INTO tags (tag_name, tag_belong_room_id)
       VALUES ($1, $2)
       RETURNING *`,
      [name, roomId]
    );

    return success(res, result.rows[0], 'Tag created', 201);
  } catch (err) {
    console.error('Create tag error:', err);
    return error(res, 'Failed to create tag', 500);
  }
};

export const deleteTag = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // Check if admin
    const tagCheck = await query(
      `SELECT t.tag_belong_room_id
       FROM tags t
       JOIN rooms r ON t.tag_belong_room_id = r.room_id
       WHERE t.tag_id = $1`,
      [id]
    );

    if (tagCheck.rows.length === 0) {
      return error(res, 'Tag not found', 404);
    }

    if (!(await isRoomAdmin(tagCheck.rows[0].tag_belong_room_id, userId))) {
      return error(res, 'Only admin can delete tags', 403);
    }

    // Delete tag mappings first
    await query('DELETE FROM item_room_tag_map WHERE irt_tag_id = $1', [id]);
    await query('DELETE FROM tags WHERE tag_id = $1', [id]);

    return success(res, null, 'Tag deleted');
  } catch (err) {
    console.error('Delete tag error:', err);
    return error(res, 'Failed to delete tag', 500);
  }
};

export const updateTag = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return error(res, 'Tag name is required');
    }

    if (name.length > 12) {
      return error(res, 'Tag name must be 12 characters or less');
    }

    const tagCheck = await query(
      `SELECT t.tag_belong_room_id
       FROM tags t
       JOIN rooms r ON t.tag_belong_room_id = r.room_id
       WHERE t.tag_id = $1`,
      [id]
    );

    if (tagCheck.rows.length === 0) {
      return error(res, 'Tag not found', 404);
    }

    if (!(await isRoomAdmin(tagCheck.rows[0].tag_belong_room_id, userId))) {
      return error(res, 'Only admin can update tags', 403);
    }

    const result = await query(
      'UPDATE tags SET tag_name = $1 WHERE tag_id = $2 RETURNING *',
      [name, id]
    );

    return success(res, result.rows[0], 'Tag updated');
  } catch (err) {
    console.error('Update tag error:', err);
    return error(res, 'Failed to update tag', 500);
  }
};

// 批量检查物品预约冲突
export const checkConflicts = async (req: AuthRequest, res: Response) => {
  try {
    const { itemIds, startTime, endTime } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return error(res, 'Item IDs are required');
    }

    if (!startTime || !endTime) {
      return error(res, 'Start time and end time are required');
    }

    if (startTime >= endTime) {
      return error(res, 'End time must be after start time');
    }

    const userId = req.user?.userId;
    for (const itemId of itemIds) {
      if (!userId || !await hasItemAccess(userId, Number(itemId))) {
        return error(res, 'Access denied', 403);
      }
    }

    const conflicts: {
      itemId: number;
      itemName: string;
      conflictingReservations: Array<{
        reservationId: number;
        startTime: number;
        endTime: number;
        userNickname: string;
      }>;
    }[] = [];

    for (const itemId of itemIds) {
      const conflictResult = await query(
        `SELECT r.reservation_id, r.reservation_start_time, r.reservation_end_time,
                i.item_name, u.user_nickname
         FROM reservations r
         JOIN items i ON r.reservation_item_id = i.item_id
         JOIN users u ON r.reservation_user_id = u.user_id
         WHERE r.reservation_item_id = $1
           AND r.reservation_is_canceled = false
           AND (
             (r.reservation_start_time <= $2 AND r.reservation_end_time >= $2)
             OR (r.reservation_start_time <= $3 AND r.reservation_end_time >= $3)
             OR (r.reservation_start_time >= $2 AND r.reservation_end_time <= $3)
           )
         ORDER BY r.reservation_start_time ASC`,
        [itemId, startTime, endTime]
      );

      if (conflictResult.rows.length > 0) {
        conflicts.push({
          itemId,
          itemName: conflictResult.rows[0].item_name,
          conflictingReservations: conflictResult.rows.map((row: any) => ({
            reservationId: row.reservation_id,
            startTime: row.reservation_start_time,
            endTime: row.reservation_end_time,
            userNickname: row.user_nickname,
          })),
        });
      }
    }

    return success(res, conflicts);
  } catch (err) {
    console.error('Check conflicts error:', err);
    return error(res, 'Failed to check conflicts', 500);
  }
};

// 更新订单标题
export const updateOrderTitle = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { title } = req.body;

    if (!title || title.trim().length === 0) {
      return error(res, '标题不能为空');
    }

    if (title.trim().length > 24) {
      return error(res, '标题最多24个字符');
    }

    const orderResult = await query(
      'SELECT * FROM orders WHERE order_id = $1 AND order_user_id = $2',
      [id, userId]
    );

    if (orderResult.rows.length === 0) {
      return error(res, 'Order not found or you do not have permission', 404);
    }

    const result = await query(
      'UPDATE orders SET order_title = $1 WHERE order_id = $2 RETURNING *',
      [title.trim(), id]
    );

    return success(res, result.rows[0], 'Title updated');
  } catch (err) {
    console.error('Update order title error:', err);
    return error(res, 'Failed to update order title', 500);
  }
};

// 延长订单
export const extendOrder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { newEndTime } = req.body;

    if (!newEndTime) {
      return error(res, '新的结束时间不能为空');
    }

    const orderResult = await query(
      'SELECT * FROM orders WHERE order_id = $1 AND order_user_id = $2',
      [id, userId]
    );

    if (orderResult.rows.length === 0) {
      return error(res, 'Order not found or you do not have permission', 404);
    }

    if (orderResult.rows[0].order_is_canceled) {
      return error(res, '订单已取消，无法延长');
    }

    const now = Date.now();
    const reservationsResult = await query(
      `SELECT * FROM reservations
       WHERE reservation_order_id = $1
         AND reservation_is_canceled = false
         AND reservation_end_time >= $2`,
      [id, now]
    );

    if (reservationsResult.rows.length === 0) {
      return error(res, '没有可以延长的预约');
    }

    const currentMaxEndTime = Math.max(
      ...reservationsResult.rows.map((r: any) =>
        typeof r.reservation_end_time === 'string'
          ? parseInt(r.reservation_end_time, 10)
          : r.reservation_end_time
      )
    );

    if (newEndTime <= currentMaxEndTime) {
      return error(res, '新的结束时间必须晚于当前最晚的结束时间');
    }

    // 检查每个预约的扩展区间是否有时间冲突
    const conflicts: string[] = [];

    for (const reservation of reservationsResult.rows) {
      const conflictCheck = await query(
        `SELECT r.*, i.item_name
         FROM reservations r
         JOIN items i ON r.reservation_item_id = i.item_id
         WHERE r.reservation_item_id = $1
           AND r.reservation_is_canceled = false
           AND r.reservation_id != $2
           AND (
             (r.reservation_start_time <= $3 AND r.reservation_end_time >= $3)
             OR (r.reservation_start_time <= $4 AND r.reservation_end_time >= $4)
             OR (r.reservation_start_time >= $3 AND r.reservation_end_time <= $4)
           )`,
        [
          reservation.reservation_item_id,
          reservation.reservation_id,
          reservation.reservation_end_time,
          newEndTime,
        ]
      );

      if (conflictCheck.rows.length > 0) {
        conflicts.push(conflictCheck.rows[0].item_name);
      }
    }

    if (conflicts.length > 0) {
      return error(res, `以下物品在延长的时间段存在冲突：${conflicts.join('、')}`);
    }

    const reservationIds = reservationsResult.rows.map((r: any) => r.reservation_id);
    await query(
      `UPDATE reservations
       SET reservation_end_time = $1
       WHERE reservation_id = ANY($2::int[])`,
      [newEndTime, reservationIds]
    );

    const formatDate = (timestamp: number) => {
      const date = new Date(timestamp);
      return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const itemNames: string[] = [];
    for (const reservation of reservationsResult.rows) {
      const itemResult = await query(
        'SELECT item_name FROM items WHERE item_id = $1',
        [reservation.reservation_item_id]
      );
      if (itemResult.rows.length > 0) {
        itemNames.push(itemResult.rows[0].item_name);
      }
    }

    const content = `预约时间已延长至 ${formatDate(newEndTime)}\n涉及物品：${itemNames.join('、')}`;
    if (userId) {
      await createNotification(userId, 'reservation', '订单已延长', content, parseInt(id));
    }

    return success(res, { updatedCount: reservationIds.length, newEndTime }, 'Order extended');
  } catch (err) {
    console.error('Extend order error:', err);
    return error(res, 'Failed to extend order', 500);
  }
};
