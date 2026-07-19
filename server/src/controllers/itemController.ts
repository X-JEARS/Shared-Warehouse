import { Request, Response } from 'express';
import { query } from '../config/database';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';
import { hasItemAccess } from '../utils/access';

export const getItems = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { roomId, boxId, tagId, search } = req.query;

    // If no roomId, return empty result (backward compatibility)
    if (!roomId) {
      return success(res, { inStock: [], outOfStock: [] });
    }

    // Verify user is member of this room
    const memberCheck = await query(
      'SELECT * FROM room_members WHERE member_room_id = $1 AND member_user_id = $2',
      [roomId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return error(res, 'Access denied', 403);
    }

    const result: { inStock: any[]; outOfStock: any[] } = { inStock: [], outOfStock: [] };

    // Helper function to add remarks to items
    const addRemarksToItems = async (items: any[], viewRoomId: number) => {
      if (items.length === 0) return items;
      const itemIds = items.map(i => i.item_id);
      const remarksResult = await query(
        `SELECT remark_item_id, remark_name FROM item_remarks
         WHERE remark_item_id = ANY($1) AND remark_room_id = $2`,
        [itemIds, viewRoomId]
      );
      const remarksMap = new Map(
        remarksResult.rows.map(r => [r.remark_item_id, r.remark_name])
      );
      return items.map(item => ({
        ...item,
        remark: remarksMap.get(item.item_id) || null
      }));
    };

    // Build common SELECT clause
    // is_in_stock: item's current_box is in the viewing room (physically present)
    // is_foreign: item belongs to other room but is currently in this room
    const selectClause = `
      SELECT DISTINCT i.*,
        bb.box_name as belong_box_name,
        cb.box_name as current_box_name,
        bb.box_belong_room_id as belong_room_id,
        cb.box_belong_room_id as current_room_id,
        u.user_nickname as owner_nickname,
        r.room_name as belong_room_name,
        cr.room_name as current_room_name,
        CASE WHEN cb.box_belong_room_id = $1 THEN true ELSE false END as is_in_stock,
        CASE WHEN bb.box_belong_room_id != $1 THEN true ELSE false END as is_foreign,
        CASE WHEN bb.box_belong_room_id IS DISTINCT FROM cb.box_belong_room_id THEN
          (SELECT u2.user_nickname FROM boxes b2
           LEFT JOIN users u2 ON u2.user_box_id = b2.box_id
           WHERE b2.box_id = i.item_current_box_id)
        ELSE NULL END as holder_nickname,
        CASE WHEN cb.box_belong_room_id IS NULL THEN
          (SELECT u3.user_nickname FROM users u3 WHERE u3.user_box_id = cb.box_id)
        ELSE cr.room_name END as display_location_name,
        ARRAY(
          SELECT irt.irt_tag_id
          FROM item_room_tag_map irt
          WHERE irt.irt_item_id = i.item_id
            AND irt.irt_room_id = $1
          ORDER BY irt.irt_tag_id
        ) as tag_ids
      FROM items i
      JOIN boxes bb ON i.item_belong_box_id = bb.box_id
      LEFT JOIN boxes cb ON i.item_current_box_id = cb.box_id
      LEFT JOIN rooms r ON bb.box_belong_room_id = r.room_id
      LEFT JOIN rooms cr ON cb.box_belong_room_id = cr.room_id
      LEFT JOIN users u ON i.item_belong_user_id = u.user_id
    `;

    // Query 1: Items currently in this room (current_box is in this room)
    // These are items physically present in this warehouse
    let inStockSql = selectClause + ` WHERE cb.box_belong_room_id = $1`;
    const inStockValues: any[] = [roomId];
    let inStockParamCount = 2;

    if (boxId) {
      inStockSql += ` AND i.item_current_box_id = $${inStockParamCount++}`;
      inStockValues.push(boxId);
    }

    if (tagId) {
      inStockSql += ` AND EXISTS (
        SELECT 1 FROM item_room_tag_map irt
        WHERE irt.irt_item_id = i.item_id
        AND irt.irt_tag_id = $${inStockParamCount++}
        AND irt.irt_room_id = $${inStockParamCount++}
      )`;
      inStockValues.push(tagId, roomId);
    }

    if (search) {
      inStockSql += ` AND (i.item_name ILIKE $${inStockParamCount++} OR i.item_notice ILIKE $${inStockParamCount++})`;
      inStockValues.push(`%${search}%`, `%${search}%`);
    }

    inStockSql += ' ORDER BY i.item_create_time DESC';

    const inStockResult = await query(inStockSql, inStockValues);
    result.inStock = await addRemarksToItems(inStockResult.rows, parseInt(roomId as string));

    // Query 2: Items that belong to this room but are NOT currently in this room
    // These are items borrowed out to other rooms/users
    if (!boxId) { // Only show out-of-stock items when not filtering by specific box
      let outOfStockSql = selectClause + ` WHERE bb.box_belong_room_id = $1 AND (cb.box_belong_room_id IS NULL OR cb.box_belong_room_id != $1)`;
      const outOfStockValues: any[] = [roomId];
      let outOfStockParamCount = 2;

      if (tagId) {
        outOfStockSql += ` AND EXISTS (
          SELECT 1 FROM item_room_tag_map irt
          WHERE irt.irt_item_id = i.item_id
          AND irt.irt_tag_id = $${outOfStockParamCount++}
          AND irt.irt_room_id = $${outOfStockParamCount++}
        )`;
        outOfStockValues.push(tagId, roomId);
      }

      if (search) {
        outOfStockSql += ` AND (i.item_name ILIKE $${outOfStockParamCount++} OR i.item_notice ILIKE $${outOfStockParamCount++})`;
        outOfStockValues.push(`%${search}%`, `%${search}%`);
      }

      outOfStockSql += ' ORDER BY i.item_create_time DESC';

      const outOfStockResult = await query(outOfStockSql, outOfStockValues);
      result.outOfStock = await addRemarksToItems(outOfStockResult.rows, parseInt(roomId as string));
    }

    return success(res, result);
  } catch (err) {
    console.error('Get items error:', err);
    return error(res, 'Failed to get items', 500);
  }
};

export const getInHandCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userResult = await query(
      'SELECT user_box_id FROM users WHERE user_id = $1',
      [userId]
    );
    if (!userResult.rows[0]?.user_box_id) {
      return success(res, { count: 0 });
    }
    const result = await query(
      'SELECT COUNT(*) FROM items WHERE item_current_box_id = $1',
      [userResult.rows[0].user_box_id]
    );
    return success(res, { count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error('Get in-hand count error:', err);
    return error(res, 'Failed to get in-hand count', 500);
  }
};

export const getInHandItems = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    // Get user's personal box
    const userResult = await query(
      'SELECT user_box_id FROM users WHERE user_id = $1',
      [userId]
    );

    if (!userResult.rows[0]?.user_box_id) {
      return success(res, []);
    }

    const userBoxId = userResult.rows[0].user_box_id;

    // Get items in user's personal box
    const result = await query(
      `SELECT i.*, u.user_nickname as owner_nickname
       FROM items i
       LEFT JOIN users u ON i.item_belong_user_id = u.user_id
       WHERE i.item_current_box_id = $1
       ORDER BY i.item_create_time DESC`,
      [userBoxId]
    );

    return success(res, result.rows);
  } catch (err) {
    console.error('Get in-hand items error:', err);
    return error(res, 'Failed to get in-hand items', 500);
  }
};

export const getItemById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { roomId } = req.query; // 当前查看的仓库ID

    // is_in_stock: item's current_box is in the viewing room (physically present)
    // is_foreign: item belongs to other room but is currently in this room
    const roomIdValue = roomId ? parseInt(roomId as string) : 0;
    const result = await query(
      `SELECT i.*,
        cb.box_name as current_box_name,
        cb.box_belong_room_id as current_room_id,
        bb.box_name as belong_box_name,
        bb.box_belong_room_id as belong_room_id,
        r.room_name as belong_room_name,
        cr.room_name as current_room_name,
        u.user_nickname as owner_nickname,
        CASE WHEN cb.box_belong_room_id = $2 THEN true ELSE false END as is_in_stock,
        CASE WHEN bb.box_belong_room_id != $2 THEN true ELSE false END as is_foreign,
        CASE WHEN bb.box_belong_room_id IS DISTINCT FROM cb.box_belong_room_id THEN
          (SELECT u2.user_nickname FROM boxes b2
           LEFT JOIN users u2 ON u2.user_box_id = b2.box_id
           WHERE b2.box_id = i.item_current_box_id)
        ELSE NULL END as holder_nickname,
        CASE WHEN cb.box_belong_room_id IS NULL THEN
          (SELECT u3.user_nickname FROM users u3 WHERE u3.user_box_id = cb.box_id)
        ELSE cr.room_name END as display_location_name
      FROM items i
      LEFT JOIN boxes cb ON i.item_current_box_id = cb.box_id
      LEFT JOIN boxes bb ON i.item_belong_box_id = bb.box_id
      LEFT JOIN rooms r ON bb.box_belong_room_id = r.room_id
      LEFT JOIN rooms cr ON cb.box_belong_room_id = cr.room_id
      LEFT JOIN users u ON i.item_belong_user_id = u.user_id
      WHERE i.item_id = $1`,
      [id, roomIdValue]
    );

    if (result.rows.length === 0) {
      return error(res, 'Item not found', 404);
    }

    const item = result.rows[0];

    if (!userId || !await hasItemAccess(userId, Number(id))) {
      return error(res, 'Access denied', 403);
    }

    // Determine which room's tags/remark to show
    // If roomId is provided, use it; otherwise fall back to belong_room_id
    const viewRoomId = roomId ? parseInt(roomId as string) : item.belong_room_id;

    // Get tags for this item in the viewing room
    if (viewRoomId) {
      const tagsResult = await query(
        `SELECT t.* FROM tags t
         JOIN item_room_tag_map irt ON t.tag_id = irt.irt_tag_id
         WHERE irt.irt_item_id = $1 AND irt.irt_room_id = $2`,
        [id, viewRoomId]
      );
      item.tags = tagsResult.rows;
    }

    // Get remark for this item in the viewing room
    if (viewRoomId) {
      const remarkResult = await query(
        'SELECT * FROM item_remarks WHERE remark_item_id = $1 AND remark_room_id = $2',
        [id, viewRoomId]
      );
      item.remark = remarkResult.rows[0]?.remark_name || null;
    }

    // Set room_id for tag/remark operations (the viewing room)
    item.room_id = viewRoomId;

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

    // 二维码长度限制
    if (qrcode.length > 64) {
      return error(res, '二维码长度不能超过64个字符', 400);
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
      `SELECT i.item_id, i.item_belong_user_id, b.box_belong_room_id
       FROM items i
       JOIN boxes b ON i.item_current_box_id = b.box_id
       WHERE i.item_id = $1`,
      [id]
    );

    if (itemCheck.rows.length === 0) {
      return error(res, 'Item not found', 404);
    }

    if (!userId || !await hasItemAccess(userId, Number(id))) {
      return error(res, 'Access denied', 403);
    }

    const result = await query(
      `SELECT h.*, u.user_nickname, b.box_name, b.box_belong_room_id,
       CASE WHEN b.box_belong_room_id IS NULL THEN true ELSE false END AS is_user_box,
       ub.user_nickname AS holder_nickname
       FROM histories h
       JOIN users u ON h.history_user_id = u.user_id
       JOIN boxes b ON h.history_box_id = b.box_id
       LEFT JOIN users ub ON ub.user_box_id = b.box_id
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
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId || !await hasItemAccess(userId, Number(id))) {
      return error(res, 'Access denied', 403);
    }

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

    if (!userId || !await hasItemAccess(userId, Number(id))) {
      return error(res, 'Access denied', 403);
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

    if (!userId || !await hasItemAccess(userId, item.item_id)) {
      return error(res, 'Access denied', 403);
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

export const getMyItems = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    // Get items where belong_user_id is the current user
    const result = await query(
      `SELECT i.*,
        cb.box_name as current_box_name,
        cb.box_belong_room_id as current_room_id,
        bb.box_name as belong_box_name,
        bb.box_belong_room_id as belong_room_id,
        r.room_name as belong_room_name,
        cr.room_name as current_room_name,
        CASE WHEN cb.box_belong_room_id IS NULL THEN
          (SELECT u3.user_nickname FROM users u3 WHERE u3.user_box_id = cb.box_id)
        ELSE cr.room_name END as display_location_name
       FROM items i
       LEFT JOIN boxes cb ON i.item_current_box_id = cb.box_id
       LEFT JOIN boxes bb ON i.item_belong_box_id = bb.box_id
       LEFT JOIN rooms r ON bb.box_belong_room_id = r.room_id
       LEFT JOIN rooms cr ON cb.box_belong_room_id = cr.room_id
       WHERE i.item_belong_user_id = $1
       ORDER BY i.item_create_time DESC`,
      [userId]
    );

    return success(res, result.rows);
  } catch (err) {
    console.error('Get my items error:', err);
    return error(res, 'Failed to get my items', 500);
  }
};

export const changeBelongBox = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { newBoxId } = req.body;

    if (!newBoxId) {
      return error(res, '新盒子ID不能为空', 400);
    }

    // 验证物品存在且当前用户是所有者
    const itemCheck = await query(
      'SELECT item_belong_user_id, item_belong_box_id FROM items WHERE item_id = $1',
      [id]
    );

    if (itemCheck.rows.length === 0) {
      return error(res, '物品不存在', 404);
    }

    if (itemCheck.rows[0].item_belong_user_id !== userId) {
      return error(res, '只有物品所有者才能更改归属盒子', 403);
    }

    // 验证新盒子存在且不是个人盒子
    const boxCheck = await query(
      `SELECT b.box_id, b.box_name, b.box_belong_room_id, r.room_name
       FROM boxes b
       LEFT JOIN rooms r ON b.box_belong_room_id = r.room_id
       WHERE b.box_id = $1`,
      [newBoxId]
    );

    if (boxCheck.rows.length === 0) {
      return error(res, '盒子不存在', 404);
    }

    const newBox = boxCheck.rows[0];

    // 检查盒子是否是个人盒子（box_belong_room_id 为 NULL）
    if (newBox.box_belong_room_id === null) {
      return error(res, '不能将物品归属到个人盒子', 400);
    }

    // 更新物品的归属盒子
    await query(
      'UPDATE items SET item_belong_box_id = $1 WHERE item_id = $2',
      [newBoxId, id]
    );

    return success(res, {
      belongBoxName: newBox.box_name,
      belongRoomName: newBox.room_name
    }, '归属盒子已更新');
  } catch (err) {
    console.error('Change belong box error:', err);
    return error(res, 'Failed to change belong box', 500);
  }
};

export const transferItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return error(res, '目标用户ID不能为空', 400);
    }

    // 验证物品存在且当前用户是所有者
    const itemCheck = await query(
      'SELECT item_belong_user_id, item_belong_box_id FROM items WHERE item_id = $1',
      [id]
    );

    if (itemCheck.rows.length === 0) {
      return error(res, '物品不存在', 404);
    }

    if (itemCheck.rows[0].item_belong_user_id !== userId) {
      return error(res, '只有物品所有者才能转让物品', 403);
    }

    // 验证目标用户存在
    const targetUserCheck = await query(
      'SELECT user_id, user_nickname, user_box_id FROM users WHERE user_id = $1',
      [targetUserId]
    );

    if (targetUserCheck.rows.length === 0) {
      return error(res, '目标用户不存在', 404);
    }

    const targetUser = targetUserCheck.rows[0];

    // 不能转让给自己
    if (targetUserId === userId) {
      return error(res, '不能转让给自己', 400);
    }

    // 只更新物品的所有者，不改变归属盒子
    await query(
      'UPDATE items SET item_belong_user_id = $1 WHERE item_id = $2',
      [targetUserId, id]
    );

    return success(res, {
      newOwnerNickname: targetUser.user_nickname
    }, '物品转让成功');
  } catch (err) {
    console.error('Transfer item error:', err);
    return error(res, 'Failed to transfer item', 500);
  }
};

export const deleteItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // 验证物品存在且当前用户是所有者
    const itemCheck = await query(
      'SELECT item_belong_user_id, item_image FROM items WHERE item_id = $1',
      [id]
    );

    if (itemCheck.rows.length === 0) {
      return error(res, '物品不存在', 404);
    }

    if (itemCheck.rows[0].item_belong_user_id !== userId) {
      return error(res, '只有物品所有者才能删除物品', 403);
    }

    // 删除关联数据（按外键依赖顺序）
    // 1. 删除预约记录
    await query('DELETE FROM reservations WHERE reservation_item_id = $1', [id]);

    // 2. 删除评论
    await query('DELETE FROM comments WHERE comment_item_id = $1', [id]);

    // 3. 删除历史记录
    await query('DELETE FROM histories WHERE history_item_id = $1', [id]);

    // 4. 删除标签映射
    await query('DELETE FROM item_room_tag_map WHERE irt_item_id = $1', [id]);

    // 5. 删除备注
    await query('DELETE FROM item_remarks WHERE remark_item_id = $1', [id]);

    // 6. 删除物品本身
    await query('DELETE FROM items WHERE item_id = $1', [id]);

    // 7. 删除物品图片文件（如果存在）
    if (itemCheck.rows[0].item_image) {
      const fs = require('fs');
      const path = require('path');
      const imagePath = path.join(__dirname, '../../public', itemCheck.rows[0].item_image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    return success(res, null, '物品已删除');
  } catch (err) {
    console.error('Delete item error:', err);
    return error(res, 'Failed to delete item', 500);
  }
};
