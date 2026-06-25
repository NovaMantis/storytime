export type EmailStatus = 'pending' | 'skipped' | 'processed' | 'error' | 'awaiting_review'
export type ProjectStatus = 'In review' | 'Ready'
export type ProcessingJobState = 'running' | 'awaiting_review' | 'enhancing' | 'completed' | 'failed'

export interface ProjectRow {
  id: string
  sender_email: string
  folder_path: string
  status: ProjectStatus
  image_order: string
  updated_at: string
}

export interface EmailRow {
  id: string
  message_id: string
  imap_uid: number | null
  sender: string
  subject: string
  received_at: string
  has_image_attachments: number
  attachment_count: number
  processed: number
  processed_at: string | null
  status: EmailStatus
  status_message: string | null
  project_id: string | null
  archived: number
}

export interface ProcessingJobRow {
  id: string
  project_id: string | null
  state: ProcessingJobState
  started_at: string
  finished_at: string | null
  error: string | null
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}
