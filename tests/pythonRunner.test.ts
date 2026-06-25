import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { AppError } from '../server/utils/errors'

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => {
    const proc = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter
      stdout: EventEmitter
    }
    proc.stderr = new EventEmitter()
    proc.stdout = new EventEmitter()
    setTimeout(() => proc.emit('close', 0), 10)
    return proc
  })
}))

vi.mock('../server/utils/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/utils/config')>()
  return {
    ...actual,
    getPythonScriptPath: () => '/tmp/fake-script.py'
  }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: (p: string) => String(p).includes('fake-script.py')
  }
})

describe('runPythonScript', () => {
  it('resolves on exit code 0', async () => {
    const { runPythonScript } = await import('../server/utils/pythonRunner')
    await expect(runPythonScript('/tmp/project')).resolves.toBeUndefined()
  })
})
