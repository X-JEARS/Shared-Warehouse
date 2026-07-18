BEGIN;

-- transfer_record_type: 1 = borrow, 2 = return
CREATE TABLE IF NOT EXISTS transfer_records (
    transfer_record_id SERIAL PRIMARY KEY,
    transfer_record_user_id INT NOT NULL REFERENCES users(user_id),
    transfer_record_type SMALLINT NOT NULL CHECK (transfer_record_type IN (1, 2)),
    transfer_record_time BIGINT NOT NULL,
    transfer_record_image VARCHAR(128)
);

ALTER TABLE histories
    ADD COLUMN IF NOT EXISTS history_transfer_record_id INT
    REFERENCES transfer_records(transfer_record_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transfer_records_user_time
    ON transfer_records(transfer_record_user_id, transfer_record_time DESC);

CREATE INDEX IF NOT EXISTS idx_histories_transfer_record
    ON histories(history_transfer_record_id);

COMMIT;
