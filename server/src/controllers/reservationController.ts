import { Request, Response } from 'express';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';
import { createNotification } from './notificationController';

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
        rm.room_name
      FROM reservations r
      JOIN items i ON r.reservation_item_id = i.item_id
      LEFT JOIN boxes b ON i.item_current_box_id = b.box_id
      LEFT JOIN rooms rm ON b.box_belong_room_id = rm.room_id
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

    // Check for conflicts
    const conflictCheck = await query(
      `SELECT * FROM reservations
       WHERE reservation_item_id = $1
         AND reservation_is_canceled = false
         AND (
           (reservation_start_time <= $2 AND reservation_end_time >= $2)
           OR (reservation_start_time <= $3 AND reservation_end_time >= $3)
           OR (reservation_start_time >= $2 AND reservation_end_time <= $3)
         )`,
      [itemId, startTime, endTime]
    );

    if (conflictCheck.rows.length > 0) {
      return error(res, 'This item is already reserved during the selected time period');
    }

    const result = await query(
      `INSERT INTO reservations (reservation_item_id, reservation_start_time, reservation_end_time, reservation_user_id, reservation_order_id, reservation_is_canceled)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING *`,
      [itemId, startTime, endTime, userId, orderId || null]
    );

    return success(res, result.rows[0], 'Reservation created', 201);
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
    const { id } = req.params;
    const { includePast } = req.query;

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
    const { title, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return error(res, 'Items array is required');
    }

    // First, check all items for conflicts before creating any reservations
    const conflicts: { itemId: number; itemName?: string }[] = [];

    for (const item of items) {
      const conflictCheck = await query(
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
      return error(res, `以下物品在所选时间已被预约：${conflicts.map(c => c.itemName || `物品${c.itemId}`).join('、')}`);
    }

    const createTime = Date.now();

    // Create order
    const orderResult = await query(
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
      const result = await query(
        `INSERT INTO reservations (reservation_item_id, reservation_start_time, reservation_end_time, reservation_user_id, reservation_order_id, reservation_is_canceled)
         VALUES ($1, $2, $3, $4, $5, false)
         RETURNING *`,
        [item.itemId, item.startTime, item.endTime, userId, order.order_id]
      );

      reservations.push(result.rows[0]);

      // 获取物品名称
      const itemResult = await query('SELECT item_name FROM items WHERE item_id = $1', [item.itemId]);
      if (itemResult.rows.length > 0) {
        itemNames.push(itemResult.rows[0].item_name);
      }
    }

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

    // Check if admin
    const roomCheck = await query(
      'SELECT room_admin FROM rooms WHERE room_id = $1',
      [roomId]
    );

    if (roomCheck.rows.length === 0) {
      return error(res, 'Room not found', 404);
    }

    if (roomCheck.rows[0].room_admin !== userId) {
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
      `SELECT t.tag_belong_room_id, r.room_admin
       FROM tags t
       JOIN rooms r ON t.tag_belong_room_id = r.room_id
       WHERE t.tag_id = $1`,
      [id]
    );

    if (tagCheck.rows.length === 0) {
      return error(res, 'Tag not found', 404);
    }

    if (tagCheck.rows[0].room_admin !== userId) {
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
      `SELECT t.tag_belong_room_id, r.room_admin
       FROM tags t
       JOIN rooms r ON t.tag_belong_room_id = r.room_id
       WHERE t.tag_id = $1`,
      [id]
    );

    if (tagCheck.rows.length === 0) {
      return error(res, 'Tag not found', 404);
    }

    if (tagCheck.rows[0].room_admin !== userId) {
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
