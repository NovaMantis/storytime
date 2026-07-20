import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { AppError } from './errors'
import { logError, logInfo } from './logger'

const execFileAsync = promisify(execFile)

const BRANCH = 'master'
const REMOTE = 'origin'

export interface UpdateStatus {
  available: boolean
  outdated: boolean
  behind: number
  branch: string | null
  localSha: string | null
  remoteSha: string | null
  reason?: string
}

function getRepoRoot() {
  return process.cwd()
}

async function git(...args: string[]) {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: getRepoRoot(),
    timeout: 60_000,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0'
    }
  })
  return {
    stdout: stdout.trim(),
    stderr: stderr.trim()
  }
}

function isGitRepo() {
  return existsSync(join(getRepoRoot(), '.git'))
}

export async function getUpdateStatus(): Promise<UpdateStatus> {
  if (!isGitRepo()) {
    return {
      available: false,
      outdated: false,
      behind: 0,
      branch: null,
      localSha: null,
      remoteSha: null,
      reason: 'not_a_git_repo'
    }
  }

  try {
    await git('fetch', REMOTE, BRANCH, '--quiet')

    const [{ stdout: behindStr }, { stdout: localSha }, { stdout: remoteSha }, { stdout: branch }] = await Promise.all([
      git('rev-list', '--count', `${BRANCH}..${REMOTE}/${BRANCH}`),
      git('rev-parse', '--short', BRANCH),
      git('rev-parse', '--short', `${REMOTE}/${BRANCH}`),
      git('rev-parse', '--abbrev-ref', 'HEAD')
    ])

    const behind = Number.parseInt(behindStr, 10) || 0

    return {
      available: true,
      outdated: behind > 0,
      behind,
      branch,
      localSha,
      remoteSha
    }
  } catch (err) {
    logError('Update status check failed', {
      error: err instanceof Error ? err.message : String(err)
    })
    return {
      available: false,
      outdated: false,
      behind: 0,
      branch: null,
      localSha: null,
      remoteSha: null,
      reason: 'check_failed'
    }
  }
}

export async function pullLatest() {
  if (!isGitRepo()) {
    throw new AppError('NOT_A_GIT_REPO', 'This install is not a git repository.', 400)
  }

  const { stdout: branch } = await git('rev-parse', '--abbrev-ref', 'HEAD')
  if (branch !== BRANCH) {
    throw new AppError(
      'WRONG_BRANCH',
      `Switch to ${BRANCH} before updating (currently on ${branch}).`,
      409
    )
  }

  const { stdout: status } = await git('status', '--porcelain')
  if (status) {
    throw new AppError(
      'DIRTY_WORKING_TREE',
      'You have uncommitted local changes. Commit or stash them before updating.',
      409
    )
  }

  try {
    await git('pull', '--ff-only', REMOTE, BRANCH)
    logInfo('Pulled latest changes from master')
    return { ok: true as const }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logError('git pull failed', { error: message })
    throw new AppError(
      'PULL_FAILED',
      `Could not pull latest changes: ${message}`,
      500
    )
  }
}
