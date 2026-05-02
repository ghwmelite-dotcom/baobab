-- C5 from code review: drop indexes that duplicate UNIQUE-constraint-implicit indexes,
-- and rebuild offline_articles unread index as a partial index ordered by saved_at.

DROP INDEX IF EXISTS idx_users_phone;
DROP INDEX IF EXISTS idx_users_email;

DROP INDEX IF EXISTS idx_offline_user_unread;
CREATE INDEX idx_offline_user_unread
  ON offline_articles(user_id, saved_at DESC)
  WHERE read_at IS NULL;
