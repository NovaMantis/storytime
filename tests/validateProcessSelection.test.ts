import { describe, expect, it } from 'vitest'
import { validateProcessSelection } from '../server/utils/validateProcessSelection'
import { AppError } from '../server/utils/errors'
import type { EmailRow } from '../server/utils/types'

function makeEmail(overrides: Partial<EmailRow> = {}): EmailRow {
  return {
    id: '1',
    message_id: 'msg-1',
    imap_uid: 1,
    sender: 'Alice <alice@example.com>',
    subject: 'Test',
    received_at: new Date().toISOString(),
    has_image_attachments: 1,
    attachment_count: 2,
    processed: 0,
    processed_at: null,
    status: 'pending',
    status_message: null,
    project_id: null,
    ...overrides
  }
}

describe('validateProcessSelection', () => {
  it('rejects empty selection', () => {
    expect(() => validateProcessSelection([])).toThrow(AppError)
  })

  it('rejects multiple senders', () => {
    const emails = [
      makeEmail({ id: '1', sender: 'Alice <alice@example.com>' }),
      makeEmail({ id: '2', sender: 'Bob <bob@example.com>' })
    ]
    expect(() => validateProcessSelection(emails)).toThrow(AppError)
    try {
      validateProcessSelection(emails)
    } catch (e) {
      expect((e as AppError).code).toBe('MULTIPLE_SENDERS')
    }
  })

  it('rejects emails without image attachments', () => {
    const emails = [makeEmail({ has_image_attachments: 0 })]
    expect(() => validateProcessSelection(emails)).toThrow(AppError)
  })

  it('rejects already processed emails', () => {
    const emails = [makeEmail({ processed: 1, status: 'processed' })]
    expect(() => validateProcessSelection(emails)).toThrow(AppError)
  })

  it('accepts valid single-sender selection', () => {
    const emails = [
      makeEmail({ id: '1' }),
      makeEmail({ id: '2', subject: 'Second email' })
    ]
    expect(() => validateProcessSelection(emails)).not.toThrow()
  })
})
