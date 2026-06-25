# Projects feature

## Purpose

Manage processed image sets per sender email address.

## Folder structure

Each project maps to `data/projects/{sanitized-sender}/`:

- `original/` — raw attachments from email
- `processed/` — Python script output
- `thumbnails/` — JPEG thumbnails for the UI
- `project.md` — markdown notes (plain text, no frontmatter)
- `output.pdf` — test PDF (phase 1)

Structured project state (`status`, `imageOrder`) lives in SQLite (`data/storytime.db`), not in `project.md`.

## Status values

- **In review** — default after processing
- **Ready** — admin has approved the output

## UI features

- Drag-and-drop thumbnail reorder (saved to SQLite)
- Notes textarea (saved to `project.md`)
- **Generate PDF** — test implementation stacks images vertically in `output.pdf`

## API

- `GET /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id` — body: `{ status?, notes?, imageOrder? }`
- `POST /api/projects/:id/generate-pdf`
- `GET /api/projects/:id/pdf`
- `GET /api/projects/:id/thumbnails/:filename`
