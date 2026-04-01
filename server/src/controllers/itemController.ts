import { Request, Response } from 'express';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';

export const getItems = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { roomId, boxId, tagId, search } = req.query;

    // Build query
    let sql = `
      SELECT DISTINCT i.*, b.box_name, b.box_belong_room_id,
        u.user_nickname as owner_nickname,
        r.room_name
      FROM items i
      JOIN boxes b ON i.item_current_box_id = b.box_id
      JOIN rooms r ON b.box_belong_room_id = r.room_id
      JOIN room_members rm ON r.room_id = rm.member_room_id
      LEFT JOIN users u ON i.item_belong_user_id = u.user_id
      WHERE rm.member_user_id = $1
    `;
    const values: any[] = [userId];
    let paramCount = 2;

    if (roomId) {
      sql += ` AND b.box_belong_room_id = $${paramCount++}`;
      values.push(roomId);
    }

    if (boxId) {
      sql += ` AND i.item_current_box_id = $${paramCount++}`;
      values.push(boxId);
    }

    if (tagId) {
      sql += ` AND EXISTS (
        SELECT 1 FROM item_room_tag_map irt
        WHERE irt.irt_item_id = i.item_id
        AND irt.irt_tag_id = $${paramCount++}
      )`;
      values.push(tagId);
    }

    if (search) {
      sql += ` AND (i.item_name ILIKE $${paramCount++} OR i.item_notice ILIKE $${paramCount})`;
      values.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY i.item_create_time DESC';

    const result = await query(sql, values);

    return success(res, result.rows);
  } catch (err) {
    console.error('Get items error:', err);
    return error(res, 'Failed to get items', 500);
  }
};

export const getItemById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const result = await query(
      `SELECT i.*, b.box_name, b.box_belong_room_id, r.room_name, r.room_id,
        u.user_nickname as owner_nickname,
        bb.box_name as belong_box_name
      FROM items i
      JOIN boxes b ON i.item_current_box_id = b.box_id
      LEFT JOIN rooms r ON b.box_belong_room_id = r.room_id
      LEFT JOIN users u ON i.item_belong_user_id = u.user_id
      LEFT JOIN boxes bb ON i.item_belong_box_id = bb.box_id
      WHERE i.item_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return error(res, 'Item not found', 404);
    }

    const item = result.rows[0];

    // Check if user has access to this item's room
    if (item.room_id) {
      const memberCheck = await query(
        'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
        [item.room_id, userId]
      );

      if (memberCheck.rows.length === 0) {
        return error(res, 'Access denied', 403);
      }
    }

    // Get tags for this item in current room
    if (item.room_id) {
      const tagsResult = await query(
        `SELECT t.* FROM tags t
         JOIN item_room_tag_map irt ON t.tag_id = irt.irt_tag_id
         WHERE irt.irt_item_id = $1 AND irt.irt_room_id = $2`,
        [id, item.room_id]
      );
      item.tags = tagsResult.rows;
    }

    // Get remark for this item in current room
    if (item.room_id) {
      const remarkResult = await query(
        'SELECT * FROM item_remarks WHERE remark_item_id = $1 AND remark_room_id = $2',
        [id, item.room_id]
      );
      item.remark = remarkResult.rows[0]?.remark_name || null;
    }

    // Check if current user is owner
    item.isOwner = item.item_belong_user_id === userId;

    return success(res, item);
  } catch (err) {
    console.error('Get item error:', err);
    return error(res, 'Failed to get item', 500);
  }
};

export const createItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { qrcode, name, boxId, belongUserId, belongBoxId, notice, image } = req.body;

    if (!qrcode || !name || !boxId) {
      return error(res, 'QR code, name, and box ID are required');
    }

    // Check if qrcode already exists
    const qrcodeCheck = await query(
      'SELECT item_id FROM items WHERE item_qrcode = $1',
      [qrcode]
    );

    if (qrcodeCheck.rows.length > 0) {
      return error(res, 'QR code already exists');
    }

    // Verify box exists and user has access
    const boxCheck = await query(
      `SELECT b.box_belong_room_id, r.room_admin
       FROM boxes b
       JOIN rooms r ON b.box_belong_room_id = r.room_id
       JOIN room_members rm ON r.room_id = rm.member_room_id
       WHERE b.box_id = $1 AND rm.member_user_id = $2`,
      [boxId, userId]
    );

    if (boxCheck.rows.length === 0) {
      return error(res, 'Box not found or access denied');
    }

    const createTime = Date.now();

    const result = await query(
      `INSERT INTO items (item_qrcode, item_name, item_current_box_id, item_belong_user_id, item_belong_box_id, item_image, item_create_time, item_notice)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        qrcode,
        name,
        boxId,
        belongUserId || userId,
        belongBoxId || boxId,
        image || null,
        createTime,
        notice || null,
      ]
    );

    return success(res, result.rows[0], 'Item created', 201);
  } catch (err) {
    console.error('Create item error:', err);
    return error(res, 'Failed to create item', 500);
  }
};

export const updateItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { name, notice, image } = req.body;

    // Check if user is owner
    const itemCheck = await query(
      'SELECT item_belong_user_id FROM items WHERE item_id = $1',
      [id]
    );

    if (itemCheck.rows.length === 0) {
      return error(res, 'Item not found', 404);
    }

    if (itemCheck.rows[0].item_belong_user_id !== userId) {
      return error(res, 'Only owner can update item', 403);
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`item_name = $${paramCount++}`);
      values.push(name);
    }

    if (notice !== undefined) {
      updates.push(`item_notice = $${paramCount++}`);
      values.push(notice);
    }

    if (image !== undefined) {
      updates.push(`item_image = $${paramCount++}`);
      values.push(image);
    }

    if (updates.length === 0) {
      return error(res, 'No fields to update');
    }

    values.push(id);
    const result = await query(
      `UPDATE items SET ${updates.join(', ')} WHERE item_id = $${paramCount}
       RETURNING *`,
      values
    );

    return success(res, result.rows[0], 'Item updated');
  } catch (err) {
    console.error('Update item error:', err);
    return error(res, 'Failed to update item', 500);
  }
};

export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // Verify item exists and user has access
    const itemCheck = await query(
      `SELECT i.item_id, b.box_belong_room_id
       FROM items i
       JOIN boxes b ON i.item_current_box_id = b.box_id
       LEFT JOIN room_members rm ON b.box_belong_room_id = rm.member_room_id AND rm.member_user_id = $2
       WHERE i.item_id = $1`,
      [id, userId]
    );

    if (itemCheck.rows.length === 0) {
      return error(res, 'Item not found or access denied', 404);
    }

    const result = await query(
      `SELECT h.*, u.user_nickname, b.box_name
       FROM histories h
       JOIN users u ON h.history_user_id = u.user_id
       JOIN boxes b ON h.history_box_id = b.box_id
       WHERE h.history_item_id = $1
       ORDER BY h.history_time DESC
       LIMIT 50`,
      [id]
    );

    return success(res, result.rows);
  } catch (err) {
    console.error('Get history error:', err);
    return error(res, 'Failed to get history', 500);
  }
};

export const getComments = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT c.*, u.user_nickname, u.user_avatar
       FROM comments c
       JOIN users u ON c.comment_user_id = u.user_id
       WHERE c.comment_item_id = $1
       ORDER BY c.comment_create_time DESC`,
      [id]
    );

    return success(res, result.rows);
  } catch (err) {
    console.error('Get comments error:', err);
    return error(res, 'Failed to get comments', 500);
  }
};

export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { content } = req.body;

    if (!content || content.length === 0) {
      return error(res, 'Comment content is required');
    }

    if (content.length > 120) {
      return error(res, 'Comment must be 120 characters or less');
    }

    const createTime = Date.now();
    const result = await query(
      `INSERT INTO comments (comment_item_id, comment_user_id, comment_create_time, comment_content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, userId, createTime, content]
    );

    return success(res, result.rows[0], 'Comment added', 201);
  } catch (err) {
    console.error('Add comment error:', err);
    return error(res, 'Failed to add comment', 500);
  }
};

export const getItemByQrcode = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { code } = req.params;

    const result = await query(
      `SELECT i.*, b.box_name, b.box_belong_room_id, r.room_name, r.room_id
       FROM items i
       JOIN boxes b ON i.item_current_box_id = b.box_id
       LEFT JOIN rooms r ON b.box_belong_room_id = r.room_id
       WHERE i.item_qrcode = $1`,
      [code]
    );

    if (result.rows.length === 0) {
      return error(res, 'Item not found', 404);
    }

    const item = result.rows[0];

    // Check if user has access
    if (item.room_id) {
      const memberCheck = await query(
        'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
        [item.room_id, userId]
      );

      if (memberCheck.rows.length === 0) {
        return error(res, 'Access denied', 403);
      }
    }

    item.isOwner = item.item_belong_user_id === userId;

    return success(res, item);
  } catch (err) {
    console.error('Get item by qrcode error:', err);
    return error(res, 'Failed to get item', 500);
  }
};

export const setItemTags = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { itemId } = req.params;
    const { roomId, tagIds } = req.body;

    if (!roomId || !tagIds || !Array.isArray(tagIds)) {
      return error(res, 'Room ID and tag IDs array are required');
    }

    // Verify user is member of room
    const memberCheck = await query(
      'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [roomId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return error(res, 'Access denied', 403);
    }

    // Delete existing tags for this item in this room
    await query(
      'DELETE FROM item_room_tag_map WHERE irt_item_id = $1 AND irt_room_id = $2',
      [itemId, roomId]
    );

    // Insert new tags
    for (const tagId of tagIds) {
      await query(
        `INSERT INTO item_room_tag_map (irt_item_id, irt_room_id, irt_tag_id)
         VALUES ($1, $2, $3)`,
        [itemId, roomId, tagId]
      );
    }

    return success(res, { tagIds }, 'Tags updated');
  } catch (err) {
    console.error('Set item tags error:', err);
    return error(res, 'Failed to set tags', 500);
  }
};

export const setItemRemark = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { itemId } = req.params;
    const { roomId, remark } = req.body;

    if (!roomId) {
      return error(res, 'Room ID is required');
    }

    // Verify user is member of room
    const memberCheck = await query(
      'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [roomId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return error(res, 'Access denied', 403);
    }

    // Delete existing remark
    await query(
      'DELETE FROM item_remarks WHERE remark_item_id = $1 AND remark_room_id = $2',
      [itemId, roomId]
    );

    // Insert new remark if provided
    if (remark && remark.trim()) {
      await query(
        `INSERT INTO item_remarks (remark_item_id, remark_room_id, remark_name)
         VALUES ($1, $2, $3)`,
        [itemId, roomId, remark.trim()]
      );
    }

    return success(res, { remark }, 'Remark updated');
  } catch (err) {
    console.error('Set item remark error:', err);
    return error(res, 'Failed to set remark', 500);
  }
};
