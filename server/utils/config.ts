import { join, resolve } from 'node:path'
import { getImageModel, getImagePrompt, getTextModel, getTextPrompt } from './settings'

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

export function isImapConfigured(): boolean {
  const { user, password } = getImapConfig()
  return Boolean(user && password)
}

export function getOpenAiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: getImageModel(),
    size: process.env.OPENAI_IMAGE_SIZE || '1024x1536',
    prompt: getImagePrompt()
  }
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

export function getOpenAiTextConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: getTextModel(),
    prompt: getTextPrompt()
  }
}
