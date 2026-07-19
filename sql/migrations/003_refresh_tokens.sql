BEGIN;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    refresh_token_id BIGSERIAL PRIMARY KEY,
    refresh_token_user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    refresh_token_hash CHAR(64) NOT NULL UNIQUE,
    refresh_token_family_id UUID NOT NULL,
    refresh_token_version INT NOT NULL,
    refresh_token_expires_at BIGINT NOT NULL,
    refresh_token_created_at BIGINT NOT NULL,
    refresh_token_last_used_at BIGINT NOT NULL,
    refresh_token_revoked_at BIGINT,
    refresh_token_replaced_by_hash CHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
    ON refresh_tokens(refresh_token_user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family
    ON refresh_tokens(refresh_token_family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
    ON refresh_tokens(refresh_token_expires_at);

COMMIT;
