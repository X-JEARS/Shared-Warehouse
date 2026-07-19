import type { PoolClient } from 'pg';
import pool from '../config/database';

type QueryExecutor = Pick<PoolClient, 'query'>;

export const hasItemAccess = async (
  userId: number,
  itemId: number,
  executor: QueryExecutor = pool
): Promise<boolean> => {
  const result = await executor.query(
    `SELECT EXISTS (
       SELECT 1
       FROM items i
       LEFT JOIN boxes belong_box ON belong_box.box_id = i.item_belong_box_id
       LEFT JOIN boxes current_box ON current_box.box_id = i.item_current_box_id
       LEFT JOIN users holder ON holder.user_box_id = current_box.box_id
       WHERE i.item_id = $1
         AND (
           i.item_belong_user_id = $2
           OR holder.user_id = $2
           OR EXISTS (
             SELECT 1
             FROM room_members rm
             WHERE rm.member_user_id = $2
               AND rm.member_room_id IN (
                 belong_box.box_belong_room_id,
                 current_box.box_belong_room_id
               )
           )
         )
     ) AS allowed`,
    [itemId, userId]
  );

  return result.rows[0]?.allowed === true;
};
