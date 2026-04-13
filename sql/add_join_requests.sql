-- 添加加入仓库请求表
-- 执行方式: psql -U postgres -d warehouse -f sql/add_join_requests.sql

CREATE TABLE IF NOT EXISTS room_join_requests (
    request_id SERIAL PRIMARY KEY,
    request_user_id INT NOT NULL REFERENCES users(user_id),
    request_room_id INT NOT NULL REFERENCES rooms(room_id),
    request_member_name VARCHAR(16),
    request_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    request_create_time BIGINT NOT NULL,
    request_process_time BIGINT,
    UNIQUE(request_user_id, request_room_id)
);

CREATE INDEX IF NOT EXISTS idx_join_requests_room ON room_join_requests(request_room_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON room_join_requests(request_user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON room_join_requests(request_status);
