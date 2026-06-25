import { describe, expect, it } from 'vitest'
import { extractEmailAddress, sanitizeEmail } from '../server/utils/sanitizeEmail'

describe('sanitizeEmail', () => {
  it('converts @ to -at-', () => {
    expect(sanitizeEmail('alice@example.com')).toBe('alice-at-example.com')
  })

  it('handles display name format', () => {
    expect(sanitizeEmail('Alice <alice@example.com>')).toBe('alice-at-example.com')
  })

  it('strips unsafe characters', () => {
    expect(sanitizeEmail('weird+tag@example.com')).toBe('weird-tag-at-example.com')
  })
})

describe('extractEmailAddress', () => {
  it('extracts from angle brackets', () => {
    expect(extractEmailAddress('Bob <bob@test.com>')).toBe('bob@test.com')
  })

  it('returns plain address', () => {
    expect(extractEmailAddress('plain@test.com')).toBe('plain@test.com')
  })
})
