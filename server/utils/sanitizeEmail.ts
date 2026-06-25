export function sanitizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  const match = normalized.match(/<([^>]+)>/)
  const address = match?.[1] || normalized
  return address
    .replace('@', '-at-')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/)
  return (match?.[1] || from).trim().toLowerCase()
}
