import type { EmailRow } from './types'
import { AppError } from './errors'
import { extractEmailAddress } from './sanitizeEmail'

export function validateProcessSelection(emails: EmailRow[]): void {
  if (emails.length === 0) {
    throw new AppError('NO_EMAILS', 'Select at least one email to process.')
  }

  const senders = new Set(emails.map(e => extractEmailAddress(e.sender)))
  if (senders.size > 1) {
    throw new AppError(
      'MULTIPLE_SENDERS',
      'Selected emails must be from the same sender.',
      400,
      { senders: [...senders] }
    )
  }

  const withoutImages = emails.filter(e => !e.has_image_attachments)
  if (withoutImages.length > 0) {
    throw new AppError(
      'NO_IMAGE_ATTACHMENTS',
      'All selected emails must have image attachments.',
      400,
      { emailIds: withoutImages.map(e => e.id) }
    )
  }

  const alreadyProcessed = emails.filter(e => e.processed)
  if (alreadyProcessed.length > 0) {
    throw new AppError(
      'ALREADY_PROCESSED',
      'One or more selected emails have already been processed.',
      400,
      { emailIds: alreadyProcessed.map(e => e.id) }
    )
  }
}

export function defaultImageOrder(filenames: string[]): string[] {
  return [...filenames].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}
