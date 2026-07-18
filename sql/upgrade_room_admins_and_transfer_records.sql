\set ON_ERROR_STOP on

-- Upgrade an existing warehouse database with room admins and transfer records.
-- This script is idempotent and does not backfill or modify existing business data.
BEGIN;

-- Additional room admins. The primary admin remains in rooms.room_admin.
CREATE TABLE IF NOT EXISTS room_admins (
    admin_id SERIAL PRIMARY KEY,
    admin_user_id INT NOT NULL REFERENCES users(user_id),
    admin_room_id INT NOT NULL REFERENCES rooms(room_id),
    admin_add_time BIGINT NOT NULL,
    UNIQUE(admin_user_id, admin_room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_admins_room
    ON room_admins(admin_room_id);

CREATE INDEX IF NOT EXISTS idx_room_admins_user
    ON room_admins(admin_user_id);

-- transfer_record_type: 1 = borrow, 2 = return
CREATE TABLE IF NOT EXISTS transfer_records (
    transfer_record_id SERIAL PRIMARY KEY,
    transfer_record_user_id INT NOT NULL REFERENCES users(user_id),
    transfer_record_type SMALLINT NOT NULL,
    transfer_record_time BIGINT NOT NULL,
    transfer_record_image VARCHAR(128)
);

-- Ensure the type constraint also exists on a partially upgraded database.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transfer_records_transfer_record_type_check'
          AND conrelid = 'transfer_records'::regclass
    ) THEN
        ALTER TABLE transfer_records
            ADD CONSTRAINT transfer_records_transfer_record_type_check
            CHECK (transfer_record_type IN (1, 2));
    END IF;
END
$$;

ALTER TABLE histories
    ADD COLUMN IF NOT EXISTS history_transfer_record_id INT;

-- Keep legacy and maintenance histories nullable while enforcing valid links.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'histories_history_transfer_record_id_fkey'
          AND conrelid = 'histories'::regclass
    ) THEN
        ALTER TABLE histories
            ADD CONSTRAINT histories_history_transfer_record_id_fkey
            FOREIGN KEY (history_transfer_record_id)
            REFERENCES transfer_records(transfer_record_id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_transfer_records_user_time
    ON transfer_records(transfer_record_user_id, transfer_record_time DESC);

CREATE INDEX IF NOT EXISTS idx_histories_transfer_record
    ON histories(history_transfer_record_id);

COMMIT;
