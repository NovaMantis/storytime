# Storytime

Local admin panel for processing story image emails from Zoho Mail.

## Quick start (Mac)

1. Install [Node.js 20+](https://nodejs.org) and Python 3
2. Clone this repository
3. Run setup once:

```bash
bash scripts/setup.sh
```

4. Edit `.env` with your Zoho IMAP credentials
5. Start the app:
   - Double-click **Start Storytime.command**, or
   - Run `bash scripts/start.sh`

The app opens at `http://localhost:3000`.

## What it does

- Polls your Zoho inbox for new emails (while the app is running)
- Shows all emails with processing status in the Inbox
- Lets you select emails from **one sender** with image attachments and click **Process**
- Saves images to `data/projects/{sender}/original/`
- Runs a Python script (dummy copier by default) → `processed/`
- Shows reorderable thumbnails, notes, and project status
- Generates a test PDF with all images in order

## Configuration

Copy `.env.example` to `.env`:

| Variable | Description |
|----------|-------------|
| `STORYTIME_DATA_DIR` | Where database, logs, and projects are stored |
| `ZOHO_IMAP_HOST` | Usually `imappro.zoho.com` |
| `ZOHO_IMAP_USER` | Your Zoho email address |
| `ZOHO_IMAP_PASSWORD` | Zoho app password or account password |
| `INBOX_POLL_INTERVAL_MS` | Poll interval (default 3 minutes) |
| `PYTHON_SCRIPT_PATH` | Path to image processing script |

## Project folders

Each sender gets a folder under `data/projects/`:

```
data/projects/alice-at-example-com/
  project.md      # notes + status (markdown with frontmatter)
  original/       # raw email attachments
  processed/      # Python script output
  thumbnails/     # UI thumbnails
  output.pdf      # generated PDF
```

## Development

```bash
npm run dev      # development server
npm test         # run tests
npm run build    # production build
```

## Documentation

- [Architecture](docs/architecture.md)
- [Extending the app](docs/extending.md)
- [Inbox feature](docs/features/inbox.md)
- [Projects feature](docs/features/projects.md)
