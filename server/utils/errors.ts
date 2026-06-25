import { createError as h3CreateError } from 'h3'
import type { ApiErrorBody } from './types'

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 400,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }

  toJSON(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details
      }
    }
  }
}

export function throwAppError(error: AppError): never {
  throw h3CreateError({
    statusCode: error.statusCode,
    statusMessage: error.message,
    data: error.toJSON()
  })
}
