CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT,
  avatar_url TEXT,
  default_model TEXT DEFAULT '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  theme TEXT DEFAULT 'dark',
  ad_blocking INTEGER DEFAULT 1,
  privacy_mode INTEGER DEFAULT 1,
  low_bandwidth_mode INTEGER DEFAULT 0,
  search_engine TEXT DEFAULT 'baobab',
  language TEXT DEFAULT 'en',
  country TEXT,
  sidebar_position TEXT DEFAULT 'right',
  bandwidth_saved_bytes INTEGER DEFAULT 0,
  ai_provider TEXT DEFAULT 'cloudflare',
  ai_provider_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE tabs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  url TEXT NOT NULL,
  favicon_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_tabs_user_position ON tabs(user_id, position);

CREATE TABLE history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  visit_count INTEGER DEFAULT 1,
  last_visited_at INTEGER DEFAULT (unixepoch()),
  ai_summary TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_history_user_visited ON history(user_id, last_visited_at DESC);
CREATE INDEX idx_history_url ON history(user_id, url);

CREATE TABLE bookmark_folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES bookmark_folders(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  folder_id TEXT REFERENCES bookmark_folders(id) ON DELETE SET NULL,
  favicon_url TEXT,
  position INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_bookmarks_user_folder ON bookmarks(user_id, folder_id, position);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  model TEXT,
  page_url TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT,
  page_context TEXT,
  tokens_used INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_chat_conversation ON chat_messages(conversation_id, created_at);

CREATE TABLE adblock_stats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT,
  ads_blocked INTEGER DEFAULT 0,
  trackers_blocked INTEGER DEFAULT 0,
  bytes_saved INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE otp_attempts (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  ip TEXT,
  succeeded INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_otp_phone_time ON otp_attempts(phone, created_at);

CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id BLOB UNIQUE NOT NULL,
  public_key BLOB NOT NULL,
  counter INTEGER DEFAULT 0,
  device_name TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  last_used_at INTEGER
);

CREATE TABLE offline_articles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  r2_key TEXT NOT NULL,
  ai_summary TEXT,
  word_count INTEGER,
  est_read_minutes INTEGER,
  saved_at INTEGER DEFAULT (unixepoch()),
  read_at INTEGER,
  size_bytes INTEGER
);
CREATE INDEX idx_offline_user_unread ON offline_articles(user_id, read_at, saved_at DESC);
