# Inbox feature

## Purpose

Show all emails synced from Zoho Mail with clear processing status.

## Sync

- Background poller runs every `INBOX_POLL_INTERVAL_MS` while the app is running
- Manual **Refresh now** calls `POST /api/inbox/sync`
- Emails upserted by `Message-ID` (no duplicates)

## Status values

| Status | Meaning |
|--------|---------|
| `pending` | Has image attachments, not yet processed |
| `skipped` | No image attachments (visible but not processable) |
| `processed` | Successfully processed into a project |
| `error` | Processing failed (see status message) |

## Processing rules

- Select one or more emails with image attachments
- All selected emails must be from the **same sender**
- Already-processed emails cannot be selected
- On success, navigates to the project detail page

## API

- `GET /api/inbox?filter=all|unprocessed|processed|errors|no-images`
- `POST /api/inbox/sync`
- `POST /api/inbox/process` — body: `{ emailIds: string[] }`
