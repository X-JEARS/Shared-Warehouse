-- Fixed Asset Management System Database Initialization Script
-- Run this script to create all tables

-- Enable UUID extension (optional, for future use)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    user_login_name VARCHAR(16) NOT NULL UNIQUE,
    user_password VARCHAR(72) NOT NULL,
    user_box_id INT NOT NULL,
    user_nickname VARCHAR(16) NOT NULL,
    user_avatar VARCHAR(32),
    user_tel VARCHAR(20),
    user_create_time BIGINT NOT NULL
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    room_id SERIAL PRIMARY KEY,
    room_name VARCHAR(24) NOT NULL,
    room_admin INT NOT NULL REFERENCES users(user_id),
    room_create_time BIGINT NOT NULL,
    room_notice VARCHAR(240)
);

-- Boxes table
CREATE TABLE IF NOT EXISTS boxes (
    box_id SERIAL PRIMARY KEY,
    box_qrcode VARCHAR(64) NOT NULL UNIQUE,
    box_name VARCHAR(24),
    box_belong_room_id INT REFERENCES rooms(room_id),
    box_create_time BIGINT NOT NULL,
    box_notice VARCHAR(120)
);

-- Add foreign key for user_box_id after boxes table is created
ALTER TABLE users ADD CONSTRAINT fk_user_box FOREIGN KEY (user_box_id) REFERENCES boxes(box_id);

-- Room members table
CREATE TABLE IF NOT EXISTS room_members (
    member_id SERIAL PRIMARY KEY,
    member_user_id INT NOT NULL REFERENCES users(user_id),
    member_room_id INT NOT NULL REFERENCES rooms(room_id),
    member_name VARCHAR(16),
    member_join_time BIGINT NOT NULL,
    UNIQUE(member_user_id, member_room_id)
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
    item_id SERIAL PRIMARY KEY,
    item_qrcode VARCHAR(64) NOT NULL UNIQUE,
    item_name VARCHAR(24) NOT NULL,
    item_current_box_id INT NOT NULL REFERENCES boxes(box_id),
    item_belong_user_id INT NOT NULL REFERENCES users(user_id),
    item_belong_box_id INT NOT NULL REFERENCES boxes(box_id),
    item_image VARCHAR(48),
    item_create_time BIGINT NOT NULL,
    item_notice VARCHAR(120)
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    tag_id SERIAL PRIMARY KEY,
    tag_name VARCHAR(12) NOT NULL,
    tag_belong_room_id INT NOT NULL REFERENCES rooms(room_id)
);

-- Item-room-tag mapping table
CREATE TABLE IF NOT EXISTS item_room_tag_map (
    irt_id BIGSERIAL PRIMARY KEY,
    irt_item_id INT NOT NULL REFERENCES items(item_id),
    irt_room_id INT NOT NULL REFERENCES rooms(room_id),
    irt_tag_id INT NOT NULL REFERENCES tags(tag_id)
);

-- Item remarks table
CREATE TABLE IF NOT EXISTS item_remarks (
    remark_id SERIAL PRIMARY KEY,
    remark_item_id INT NOT NULL REFERENCES items(item_id),
    remark_room_id INT NOT NULL REFERENCES rooms(room_id),
    remark_name VARCHAR(24) NOT NULL,
    UNIQUE(remark_item_id, remark_room_id)
);

-- Histories table
CREATE TABLE IF NOT EXISTS histories (
    history_id SERIAL PRIMARY KEY,
    history_item_id INT NOT NULL REFERENCES items(item_id),
    history_user_id INT NOT NULL REFERENCES users(user_id),
    history_box_id INT NOT NULL REFERENCES boxes(box_id),
    history_time BIGINT NOT NULL
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    comment_id SERIAL PRIMARY KEY,
    comment_item_id INT NOT NULL REFERENCES items(item_id),
    comment_user_id INT NOT NULL REFERENCES users(user_id),
    comment_create_time BIGINT NOT NULL,
    comment_content VARCHAR(120) NOT NULL
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    order_create_time BIGINT NOT NULL,
    order_user_id INT NOT NULL REFERENCES users(user_id),
    order_title VARCHAR(24),
    order_is_canceled BOOLEAN NOT NULL DEFAULT FALSE
);

-- Reservations table
CREATE TABLE IF NOT EXISTS reservations (
    reservation_id SERIAL PRIMARY KEY,
    reservation_item_id INT NOT NULL REFERENCES items(item_id),
    reservation_start_time BIGINT NOT NULL,
    reservation_end_time BIGINT NOT NULL,
    reservation_user_id INT NOT NULL REFERENCES users(user_id),
    reservation_order_id INT NOT NULL REFERENCES orders(order_id),
    reservation_is_canceled BOOLEAN NOT NULL DEFAULT FALSE
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    notification_user_id INT NOT NULL REFERENCES users(user_id),
    notification_type VARCHAR(20) NOT NULL,
    notification_title VARCHAR(48) NOT NULL,
    notification_content VARCHAR(240),
    notification_related_id INT,
    notification_is_read BOOLEAN NOT NULL DEFAULT FALSE,
    notification_create_time BIGINT NOT NULL
);

-- Room admins table (additional/secondary admins per room; primary admin is rooms.room_admin)
CREATE TABLE IF NOT EXISTS room_admins (
    admin_id SERIAL PRIMARY KEY,
    admin_user_id INT NOT NULL REFERENCES users(user_id),
    admin_room_id INT NOT NULL REFERENCES rooms(room_id),
    admin_add_time BIGINT NOT NULL,
    UNIQUE(admin_user_id, admin_room_id)
);

-- Room join requests table
CREATE TABLE IF NOT EXISTS room_join_requests (
    request_id SERIAL PRIMARY KEY,
    request_user_id INT NOT NULL REFERENCES users(user_id),
    request_room_id INT NOT NULL REFERENCES rooms(room_id),
    request_member_name VARCHAR(16),
    request_status VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    request_create_time BIGINT NOT NULL,
    request_process_time BIGINT,
    UNIQUE(request_user_id, request_room_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_items_current_box ON items(item_current_box_id);
CREATE INDEX IF NOT EXISTS idx_items_belong_user ON items(item_belong_user_id);
CREATE INDEX IF NOT EXISTS idx_items_qrcode ON items(item_qrcode);

CREATE INDEX IF NOT EXISTS idx_boxes_room ON boxes(box_belong_room_id);
CREATE INDEX IF NOT EXISTS idx_boxes_qrcode ON boxes(box_qrcode);

CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(member_room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(member_user_id);

CREATE INDEX IF NOT EXISTS idx_room_admins_room ON room_admins(admin_room_id);
CREATE INDEX IF NOT EXISTS idx_room_admins_user ON room_admins(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_tags_room ON tags(tag_belong_room_id);

CREATE INDEX IF NOT EXISTS idx_irt_item ON item_room_tag_map(irt_item_id);
CREATE INDEX IF NOT EXISTS idx_irt_room ON item_room_tag_map(irt_room_id);

CREATE INDEX IF NOT EXISTS idx_remarks_item ON item_remarks(remark_item_id);
CREATE INDEX IF NOT EXISTS idx_remarks_room ON item_remarks(remark_room_id);

CREATE INDEX IF NOT EXISTS idx_histories_item ON histories(history_item_id);
CREATE INDEX IF NOT EXISTS idx_histories_time ON histories(history_time);

CREATE INDEX IF NOT EXISTS idx_comments_item ON comments(comment_item_id);

CREATE INDEX IF NOT EXISTS idx_reservations_item ON reservations(reservation_item_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(reservation_user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_time ON reservations(reservation_start_time, reservation_end_time);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(notification_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(notification_is_read);

CREATE INDEX IF NOT EXISTS idx_join_requests_room ON room_join_requests(request_room_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON room_join_requests(request_user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON room_join_requests(request_status);

-- Insert a default admin box (for users created before they get their personal box)
-- INSERT INTO boxes (box_qrcode, box_create_time) VALUES ('system.default', 0);

-- Grant permissions (adjust as needed for your PostgreSQL setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
