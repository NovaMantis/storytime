# Projects feature

## Purpose

Manage processed image sets per sender email address.

## Folder structure

Each project maps to `data/projects/{sanitized-sender}/`:

- `original/` — raw attachments from email
- `processed/` — Python script output
- `thumbnails/` — JPEG thumbnails for the UI
- `text/` — extracted text files keyed by processed image basename
- `project.md` — markdown notes (plain text, no frontmatter)
- `manuscript.json` — persisted manuscript layout (pages, image transforms, text boxes)
- `manuscript.original.json` — immutable snapshot from first manuscript create (used by Reset)
- `output.pdf` — PDF exported from the manuscript editor

Site-wide media lives at `data/media/` (see Media page).

Structured project state (`status`, `imageOrder`) lives in SQLite (`data/storytime.db`), not in `project.md`.

## Status values

- **In review** — default after processing
- **Ready** — admin has approved the output

## UI features

- Drag-and-drop thumbnail reorder (saved to SQLite)
- Notes textarea (saved to `project.md`)
- **Manuscript Editor** — Canva-like layout editor at print size 8.155 × 10.25 in
  - Default page sequence: image 1 → blank → title (image 1 text) → remaining images with text overlays
  - Drag/resize images and text boxes; Google Fonts; reorder/delete pages; insert blank pages
  - Image resize keeps aspect ratio; crop from all four corners selects the visible region
  - Add images via thumbnail media dialog (this project + site media); layers always under text
  - Align H / Align V; Undo; **Reset** restores `manuscript.original.json` after confirm
  - Text defaults to black; color can be changed in the inspector
  - **Generate PDF** from the editor (exact match to layout)
- Extracted text on the project page is independent of manuscript text after creation

## Settings

- **Manuscript default font** — Google Fonts family name (default `Literata`) used for new manuscripts and new text boxes

## API

- `GET /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id` — body: `{ status?, notes?, imageOrder? }`
- `GET /api/projects/:id/manuscript` — load or auto-create manuscript (+ original snapshot if missing)
- `PUT /api/projects/:id/manuscript` — body: `{ manuscript }`
- `POST /api/projects/:id/manuscript/reset` — restore original snapshot
- `POST /api/projects/:id/generate-pdf` — render PDF from `manuscript.json`
- `GET /api/projects/:id/pdf`
- `GET /api/projects/:id/thumbnails/:filename`
- `GET /api/media` — list site-wide media
- `POST /api/media` — multipart upload (`file`)
- `GET /api/media/:id` / `GET /api/media/:id/thumb`
- `DELETE /api/media/:id`
