import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { getLogPath } from './config'

function ensureLogDir() {
  mkdirSync(dirname(getLogPath()), { recursive: true })
}

export function logInfo(message: string, meta?: Record<string, unknown>) {
  writeLog('INFO', message, meta)
}

export function logError(message: string, meta?: Record<string, unknown>) {
  writeLog('ERROR', message, meta)
}

function writeLog(level: string, message: string, meta?: Record<string, unknown>) {
  ensureLogDir()
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...meta
  })
  appendFileSync(getLogPath(), `${line}\n`, 'utf8')
}
