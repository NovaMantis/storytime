import { describe, expect, it } from 'vitest'
import { formatImapError } from '../server/utils/imap'

describe('formatImapError', () => {
  it('returns friendly message for empty mailbox fetch', () => {
    expect(formatImapError({ message: 'Command failed', responseText: 'Invalid messageset' }))
      .toContain('empty')
  })

  it('returns auth hint for invalid credentials', () => {
    expect(formatImapError({ responseText: 'Invalid credentials(Failure)' }))
      .toContain('app-specific password')
  })

  it('returns helpful message for generic command failed', () => {
    expect(formatImapError({ message: 'Command failed' }))
      .toContain('IMAP')
  })

  it('parses Message-ID from imapflow header buffer', async () => {
    const { parseMessageId } = await import('../server/utils/imap')
    const headers = Buffer.from('Message-ID: <abc@example.com>\r\n')
    expect(parseMessageId({ uid: 42, headers })).toBe('abc@example.com')
    expect(parseMessageId({ uid: 42 })).toBe('imap-uid-42@storytime.local')
  })

  it('detects image attachments from imapflow body structure', async () => {
    const { collectImageAttachments } = await import('../server/utils/imap')

    const structure = {
      type: 'multipart/mixed',
      childNodes: [
        { type: 'text/plain' },
        {
          type: 'image/jpeg',
          disposition: 'attachment',
          dispositionParameters: { filename: 'story.jpg' }
        },
        {
          type: 'image/png',
          parameters: { name: 'scan.png' }
        }
      ]
    }

    const attachments = collectImageAttachments(structure)
    expect(attachments).toEqual([
      { filename: 'story.jpg', contentType: 'image/jpeg' },
      { filename: 'scan.png', contentType: 'image/png' }
    ])
  })

  it('ignores non-image parts in body structure', async () => {
    const { collectImageAttachments } = await import('../server/utils/imap')

    const attachments = collectImageAttachments({
      type: 'multipart/mixed',
      childNodes: [
        { type: 'text/plain' },
        { type: 'application/pdf', dispositionParameters: { filename: 'doc.pdf' } }
      ]
    })

    expect(attachments).toEqual([])
  })
})
