# Storytime

Local admin panel for processing story image emails from Zoho Mail.

## Quick start (Mac)

1. Install [Node.js 20+](https://nodejs.org)
2. Clone this repository
3. Run setup once:

```bash
bash scripts/setup.sh
```

4. Edit `.env` with your Zoho IMAP credentials and `OPENAI_API_KEY`
5. Start the app (dev server — no build step):
   - Double-click **Start Storytime.command**, or
   - Run `bash scripts/start.sh`

The app opens at `http://localhost:3200`.

## What it does

- Polls your Zoho inbox for new emails (while the app is running)
- Shows all emails with processing status in the Inbox
- Lets you select emails from **one sender** with image attachments and click **Process**
- Saves images to `data/projects/{sender}/original/`
- Preprocesses images with Sharp (brightness, white background, portrait layout) → `preprocessed/`
- Review screen lets you choose which images need OpenAI worksheet cleanup → `processed/`
- Shows reorderable thumbnails, notes, and project status
- Generates a test PDF with all images in order

## Configuration

Copy `.env.example` to `.env`:

| Variable | Description |
|----------|-------------|
| `STORYTIME_DATA_DIR` | Where database, logs, and projects are stored |
| `ZOHO_IMAP_HOST` | Usually `imappro.zoho.com` |
| `ZOHO_IMAP_USER` | Your Zoho email address |
| `ZOHO_IMAP_PASSWORD` | Zoho **app-specific password** (required if 2FA is on) |
| `INBOX_POLL_INTERVAL_MS` | Poll interval (default 3 minutes) |
| `OPENAI_API_KEY` | OpenAI API key for optional AI enhancement on selected images |
| `OPENAI_IMAGE_MODEL` | Optional default for image model (overridable in Settings) |
| `OPENAI_IMAGE_SIZE` | Optional (default `1024x1536`) |
| `OPENAI_TEXT_MODEL` | Optional default for text extraction model (overridable in Settings) |

The image processing prompt and models are configured in the admin **Settings** page (stored in the local database).

## Zoho IMAP troubleshooting

If you see a red sync error banner:

1. **Enable IMAP** in Zoho Mail → Settings → Mail Accounts → IMAP Access
2. **Use an app-specific password** if 2FA is enabled ([Zoho help](https://www.zoho.com/mail/help/imap-access.html)) — your normal login password often will not work
3. **Check the host** — custom domain accounts use `imappro.zoho.com`; personal `@zoho.com` accounts use `imap.zoho.com`
4. **Test credentials** from the project folder:
   ```bash
   npx tsx --env-file=.env scripts/test-imap.mts
   ```

An empty inbox is fine — it will sync successfully with 0 emails.

## Project folders

Each sender gets a folder under `data/projects/`:

```
data/projects/alice-at-example-com/
  project.md      # admin notes (plain markdown)
  original/       # raw email attachments
  processed/      # OpenAI-enhanced PNGs
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
