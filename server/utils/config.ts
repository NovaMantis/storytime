import { join, resolve } from 'node:path'

export function getDataDir(): string {
  const dir = process.env.STORYTIME_DATA_DIR || './data'
  return resolve(process.cwd(), dir)
}

export function getProjectsDir(): string {
  return join(getDataDir(), 'projects')
}

export function getDbPath(): string {
  return join(getDataDir(), 'storytime.db')
}

export function getLogPath(): string {
  return join(getDataDir(), 'logs', 'app.log')
}

export function getImapConfig() {
  return {
    host: process.env.ZOHO_IMAP_HOST || 'imappro.zoho.com',
    user: process.env.ZOHO_IMAP_USER || '',
    password: process.env.ZOHO_IMAP_PASSWORD || '',
    mailbox: process.env.ZOHO_IMAP_MAILBOX || 'INBOX',
    pollIntervalMs: Number(process.env.INBOX_POLL_INTERVAL_MS || 180000)
  }
}

export function getPythonScriptPath(): string {
  const script = process.env.PYTHON_SCRIPT_PATH || './scripts/process_images.py'
  return resolve(process.cwd(), script)
}

export function isImapConfigured(): boolean {
  const { user, password } = getImapConfig()
  return Boolean(user && password)
}
