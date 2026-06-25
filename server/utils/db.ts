import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { getDbPath } from './config'

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  sender_email TEXT NOT NULL UNIQUE,
  folder_path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'In review',
  image_order TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  imap_uid INTEGER,
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  received_at TEXT NOT NULL,
  has_image_attachments INTEGER NOT NULL DEFAULT 0,
  attachment_count INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  processed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  status_message TEXT,
  project_id TEXT REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  state TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_emails_processed ON emails(processed);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
`

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const path = getDbPath()
    mkdirSync(dirname(path), { recursive: true })
    db = new Database(path)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.exec(MIGRATIONS)
  }
  return db
}

export function setMeta(key: string, value: string) {
  getDb()
    .prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value)
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
