# BirdNET Detections on Cloudflare

This project contains a Vite client and a Cloudflare Worker API. The Worker
stores detection metadata in D1 and BirdNET-Pi media in R2. The browser only
calls public read endpoints and never receives the Pi upload secret or R2
credentials.

## Cloudflare setup

Create a D1 database and an R2 bucket, then replace the placeholders in
`wrangler.toml`:

```bash
wrangler d1 create birdnet-db
wrangler r2 bucket create birdnet-media
```

Run the schema migration locally or against the remote database:

```bash
wrangler d1 migrations apply birdnet-db --local
wrangler d1 migrations apply birdnet-db --remote
```

Set the Pi secret. It is a Worker secret and must not be included in the
client build:

```bash
wrangler secret put PI_UPLOAD_SECRET
```

Configure a public custom domain for the `birdnet-media` R2 bucket. The
custom-domain base URL is used only for read access to media; R2 credentials
and writes remain private to the Worker.

Deploy with:

```bash
pnpm run build
wrangler deploy
```

## Worker API

Pi uploads require `Authorization: Bearer <PI_UPLOAD_SECRET>`.

Upload media with the requested object path and a supported content type:

```bash
curl -X PUT "$WORKER_URL/media/2026/08/23/black%20bird.wav" \
  -H "Authorization: Bearer $PI_UPLOAD_SECRET" \
  -H "Content-Type: audio/wav" \
  --data-binary @black-bird.wav
```

Supported media types are WAV, MP3, FLAC, and PNG. The response is:

```json
{"path":"2026/08/23/black bird.wav"}
```

Post one detection or an array of detections to `/detections`:

```json
{
  "date": "2026-08-23",
  "time": "12:34:56",
  "sci_name": "Turdus merula",
  "com_name": "Blackbird",
  "confidence": 0.91,
  "lat": -41.2,
  "lon": 174.8,
  "cutoff": 0.7,
  "week": 34,
  "sens": 1.0,
  "overlap": 0.0,
  "file_name": "black-bird.wav",
  "audio_path": "2026/08/23/black bird.wav",
  "spectrogram_path": "2026/08/23/black bird.png"
}
```

Public reads are:

```text
GET /detections?date=YYYY-MM-DD&offset=0&search=black
GET /species?date=YYYY-MM-DD
```

The client also uses `start_date` and `end_date` for date ranges. Detection
responses include `audio_path` and `spectrogram_path`, which are nullable for
older rows.

## Client environment

Copy `.env.example` to `.env.local` for local development. Set the same
variables as Cloudflare build environment variables for the Worker deployment:

```ini
VITE_API_BASE=https://birdnet-worker.YOUR-SUBDOMAIN.workers.dev
VITE_R2_PUBLIC_BASE=https://media.example.com
```

Vite embeds these values during `pnpm run build`. The client constructs media
URLs as `${VITE_R2_PUBLIC_BASE}/${path}`, encoding each path segment so spaces
and special characters work correctly.

## Development and validation

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```
