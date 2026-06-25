# Projects feature

## Purpose

Manage processed image sets per sender email address.

## Folder structure

Each project maps to `data/projects/{sanitized-sender}/`:

- `original/` — raw attachments from email
- `processed/` — Python script output
- `thumbnails/` — JPEG thumbnails for the UI
- `project.md` — markdown notes with YAML frontmatter
- `output.pdf` — test PDF (phase 1)

## Frontmatter fields

```yaml
---
status: In review
imageOrder:
  - image-1.jpg
  - image-2.jpg
updatedAt: 2025-01-01T00:00:00.000Z
senderEmail: alice@example.com
---
```

## Status values

- **In review** — default after processing
- **Ready** — admin has approved the output

## UI features

- Drag-and-drop thumbnail reorder (saved to SQLite + `project.md`)
- Notes textarea (markdown body in `project.md`)
- **Generate PDF** — test implementation stacks images vertically in `output.pdf`

## API

- `GET /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id` — body: `{ status?, notes?, imageOrder? }`
- `POST /api/projects/:id/generate-pdf`
- `GET /api/projects/:id/pdf`
- `GET /api/projects/:id/thumbnails/:filename`
