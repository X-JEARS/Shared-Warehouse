-- Migration: Change qrcode fields from VARCHAR(32) to VARCHAR(64)
-- Run this script to update the database schema

-- Modify boxes.box_qrcode from VARCHAR(32) to VARCHAR(64)
ALTER TABLE boxes ALTER COLUMN box_qrcode TYPE VARCHAR(64);

-- Modify items.item_qrcode from VARCHAR(32) to VARCHAR(64)
ALTER TABLE items ALTER COLUMN item_qrcode TYPE VARCHAR(64);

-- Note: The existing indexes on these columns will continue to work
-- No need to recreate them
