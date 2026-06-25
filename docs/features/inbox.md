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
| `awaiting_review` | Attachments downloaded and preprocessed; admin must review and finalize |
| `skipped` | No image attachments (visible but not processable) |
| `processed` | Successfully finalized into a project |
| `error` | Processing failed (see status message) |

## Processing rules

- Select one or more emails with image attachments
- All selected emails must be from the **same sender**
- Already-processed or awaiting-review emails cannot be selected
- Clicking **Process** saves attachments to `original/` then runs Sharp preprocessing to `preprocessed/`
- Admin is taken to a **review** page to preview preprocessed images and multi-select which need OpenAI enhancement
- **Continue** copies unselected images from `preprocessed/` to `processed/`; selected images are enhanced via OpenAI
- On finalize, navigates to the project detail page

## API

- `GET /api/inbox?filter=all|unprocessed|awaiting-review|processed|errors|no-images|archived&email=<sender>`
- `POST /api/inbox/sync`
- `POST /api/inbox/process` — body: `{ emailIds: string[] }` (stage 1: download + preprocess)
- `GET /api/projects/:id/review` — review payload for pending project
- `POST /api/projects/:id/finalize` — body: `{ aiFilenames: string[] }` (stage 2: selective AI + complete)
