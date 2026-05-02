import type { D1Database } from '@cloudflare/workers-types'
import { nanoid } from 'nanoid'

// 21-char URL-safe (A-Z a-z 0-9 _ -) = 126 bits entropy. Time-sortability
// is intentionally NOT a property — pagination indexes order by timestamp
// columns (saved_at, last_visited_at, position) rather than by id.
export function newId(): string {
  return nanoid()
}

export interface UserRow {
  id: string
  phone: string | null
  email: string | null
  password_hash: string | null
  display_name: string | null
  avatar_url: string | null
  default_model: string
  theme: string
  ad_blocking: number
  privacy_mode: number
  low_bandwidth_mode: number
  search_engine: string
  language: string
  country: string | null
  sidebar_position: string
  bandwidth_saved_bytes: number
  ai_provider: string
  ai_provider_url: string | null
  is_active: number
  created_at: number
  updated_at: number
}

export async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()
}

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>()
}

export async function getUserByPhone(db: D1Database, phone: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first<UserRow>()
}

export async function insertUser(
  db: D1Database,
  user: { id: string; phone?: string; email?: string; password_hash?: string; display_name?: string }
): Promise<void> {
  await db.prepare(
    'INSERT INTO users (id, phone, email, password_hash, display_name) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.id, user.phone ?? null, user.email ?? null, user.password_hash ?? null, user.display_name ?? null).run()
}
