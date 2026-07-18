import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middlewares/auth';
import { error, success } from '../utils/response';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const parsePositiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const getMyTransferRecords = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return error(res, 'Unauthorized', 401);
    }

    const page = parsePositiveInteger(req.query.page, 1);
    const pageSize = Math.min(
      parsePositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const offset = (page - 1) * pageSize;

    const [recordsResult, countResult] = await Promise.all([
      query(
        `SELECT transfer_record_id, transfer_record_type, transfer_record_time, transfer_record_image
         FROM transfer_records
         WHERE transfer_record_user_id = $1
         ORDER BY transfer_record_time DESC, transfer_record_id DESC
         LIMIT $2 OFFSET $3`,
        [userId, pageSize, offset]
      ),
      query(
        'SELECT COUNT(*) FROM transfer_records WHERE transfer_record_user_id = $1',
        [userId]
      ),
    ]);

    const recordIds = recordsResult.rows.map((record) => record.transfer_record_id);
    const historiesResult = recordIds.length > 0
      ? await query(
          `SELECT h.history_id, h.history_transfer_record_id, h.history_item_id,
                  h.history_box_id, h.history_time,
                  i.item_name, i.item_image,
                  b.box_name, b.box_belong_room_id,
                  holder.user_nickname AS holder_nickname
           FROM histories h
           JOIN items i ON i.item_id = h.history_item_id
           JOIN boxes b ON b.box_id = h.history_box_id
           LEFT JOIN users holder ON holder.user_box_id = b.box_id
           WHERE h.history_transfer_record_id = ANY($1::int[])
           ORDER BY h.history_id ASC`,
          [recordIds]
        )
      : { rows: [] };

    const itemsByRecord = new Map<number, any[]>();
    for (const history of historiesResult.rows) {
      const items = itemsByRecord.get(history.history_transfer_record_id) || [];
      items.push(history);
      itemsByRecord.set(history.history_transfer_record_id, items);
    }

    const items = recordsResult.rows.map((record) => ({
      ...record,
      items: itemsByRecord.get(record.transfer_record_id) || [],
    }));
    const total = Number(countResult.rows[0]?.count || 0);

    return success(res, {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error('Get transfer records error:', err);
    return error(res, 'Failed to get transfer records', 500);
  }
};
