import { Request, Response } from 'express';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';
import { hasItemAccess } from '../utils/access';

// In-memory cart storage (for simplicity; in production, use Redis or database)
// Key: userId, Value: Array of { itemId, roomId, startTime, endTime }
const carts: Map<number, any[]> = new Map();

export const getCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return error(res, 'Unauthorized', 401);
    }
    const cart = carts.get(userId) || [];

    // Get item details
    const items = [];
    for (const item of cart) {
      const result = await query(
        `SELECT i.item_id, i.item_name, i.item_qrcode, i.item_image, b.box_name, r.room_name
         FROM items i
         LEFT JOIN boxes b ON i.item_current_box_id = b.box_id
         LEFT JOIN rooms r ON b.box_belong_room_id = r.room_id
         WHERE i.item_id = $1`,
        [item.itemId]
      );

      if (result.rows.length > 0) {
        items.push({
          ...result.rows[0],
          startTime: item.startTime,
          endTime: item.endTime,
          roomId: item.roomId,
        });
      }
    }

    return success(res, items);
  } catch (err) {
    console.error('Get cart error:', err);
    return error(res, 'Failed to get cart', 500);
  }
};

export const addToCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return error(res, 'Unauthorized', 401);
    }
    const { itemId, roomId, startTime, endTime } = req.body;

    if (!itemId) {
      return error(res, 'Item ID is required');
    }

    // Verify item exists and user has access
    const itemCheck = await query(
      `SELECT i.*, b.box_belong_room_id
       FROM items i
       JOIN boxes b ON i.item_current_box_id = b.box_id
       WHERE i.item_id = $1`,
      [itemId]
    );

    if (itemCheck.rows.length === 0) {
      return error(res, 'Item not found', 404);
    }

    const item = itemCheck.rows[0];

    if (item.box_belong_room_id) {
      const memberCheck = await query(
        'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
        [item.box_belong_room_id, userId]
      );

      if (memberCheck.rows.length === 0) {
        return error(res, 'Access denied', 403);
      }
    }

    // Get or create cart
    let cart = carts.get(userId) || [];

    // Check if item already in cart
    const existingIndex = cart.findIndex((c) => c.itemId === itemId);
    if (existingIndex >= 0) {
      // Update existing
      cart[existingIndex] = { itemId, roomId, startTime, endTime };
    } else {
      // Add new
      cart.push({ itemId, roomId, startTime, endTime });
    }

    carts.set(userId, cart);

    return success(res, { itemCount: cart.length }, 'Added to cart');
  } catch (err) {
    console.error('Add to cart error:', err);
    return error(res, 'Failed to add to cart', 500);
  }
};

export const removeFromCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return error(res, 'Unauthorized', 401);
    }
    const { itemId } = req.params;

    let cart = carts.get(userId) || [];
    cart = cart.filter((c) => c.itemId !== parseInt(itemId));
    carts.set(userId, cart);

    return success(res, { itemCount: cart.length }, 'Removed from cart');
  } catch (err) {
    console.error('Remove from cart error:', err);
    return error(res, 'Failed to remove from cart', 500);
  }
};

export const checkout = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return error(res, 'Unauthorized', 401);
    }
    const { title } = req.body;

    // Atomically retrieve and clear cart to prevent double-checkout race
    const cart = carts.get(userId) || [];
    carts.delete(userId);

    if (cart.length === 0) {
      return error(res, 'Cart is empty');
    }

    // Re-verify item access BEFORE creating any database records
    for (const item of cart) {
      if (!await hasItemAccess(userId, Number(item.itemId))) {
        carts.set(userId, cart); // restore cart on failure
        return error(res, 'Access denied: you no longer have access to one or more cart items', 403);
      }
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

    // Create reservations
    const reservations = [];
    const errors = [];

    for (const item of cart) {
      if (item.startTime && item.endTime) {
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
          [item.itemId, item.startTime, item.endTime]
        );

        if (conflictCheck.rows.length > 0) {
          errors.push({ itemId: item.itemId, error: 'Conflicting reservation' });
          continue;
        }

        const result = await query(
          `INSERT INTO reservations (reservation_item_id, reservation_start_time, reservation_end_time, reservation_user_id, reservation_order_id, reservation_is_canceled)
           VALUES ($1, $2, $3, $4, $5, false)
           RETURNING *`,
          [item.itemId, item.startTime, item.endTime, userId, order.order_id]
        );

        reservations.push(result.rows[0]);
      }
    }

    return success(res, { order, reservations, errors }, 'Checkout completed', 201);
  } catch (err) {
    console.error('Checkout error:', err);
    return error(res, 'Failed to checkout', 500);
  }
};

export const clearCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return error(res, 'Unauthorized', 401);
    }
    carts.delete(userId);
    return success(res, null, 'Cart cleared');
  } catch (err) {
    console.error('Clear cart error:', err);
    return error(res, 'Failed to clear cart', 500);
  }
};
