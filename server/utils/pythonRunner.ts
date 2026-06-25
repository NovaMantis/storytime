import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { getPythonScriptPath } from './config'
import { AppError } from './errors'
import { logError, logInfo } from './logger'

export function runPythonScript(projectFolderPath: string): Promise<void> {
  const scriptPath = getPythonScriptPath()
  if (!existsSync(scriptPath)) {
    throw new AppError('PYTHON_SCRIPT_MISSING', `Python script not found at ${scriptPath}`, 500)
  }

  return new Promise((resolve, reject) => {
    logInfo('Running Python script', { scriptPath, projectFolderPath })
    const proc = spawn('python3', [scriptPath, projectFolderPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('error', (err) => {
      logError('Failed to spawn Python', { error: err.message })
      reject(new AppError('PYTHON_SPAWN_FAILED', err.message, 500))
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        const message = stderr.trim() || `Python script exited with code ${code}`
        logError('Python script failed', { code, stderr })
        reject(new AppError('PYTHON_SCRIPT_FAILED', message, 500, { code, stderr }))
      }
    })
  })
}
