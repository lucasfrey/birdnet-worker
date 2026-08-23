# BirdNET Detections Client on Cloudflare

A small standalone [Vite](https://vitejs.dev) app, written in TypeScript, that
displays your BirdNET-Pi detections from Supabase using a native Web Component
(`<detections-table>`).
It mirrors the "detections_table" from the main BirdNET-Pi web UI: today's
detections, newest first, with search and "Load 40 More" pagination.

## Security

This app runs in the browser, so it uses the Supabase **anon** (publishable)
key — **never** the `service_role` key. Enable a read-only row-level-security
policy on the `detections` table so the anon key can only read:

```sql
alter table public.detections enable row level security;

create policy "public read"
  on public.detections for select
  to anon using (true);

grant select on public.detections to anon;
```

## Setup

```bash
cd client
pnpm install
cp .env.example .env.local   # then edit .env.local with your URL + anon key
pnpm dev
```

Open the printed URL (default http://localhost:5173).

## Environment

`.env.local` (gitignored):

```ini
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## What it shows

| Column                           | Source                                |
| -------------------------------- | ------------------------------------- |
| Time                             | `detections.time`                     |
| Common Name (links to Wikipedia) | `detections.com_name` / `sci_name`    |
| Scientific Name                  | `detections.sci_name`                 |
| Confidence                       | `round(detections.confidence * 100)%` |

Audio clips and species images are not included — those files live on the Pi,
not in Supabase.

## TypeScript

Type checking uses the [TypeScript 7 native compiler](https://devblogs.microsoft.com/typescript/typescript-native-port/)
(`tsgo`, shipped as `@typescript/native-preview`). Vite transpiles the `.ts`
sources with esbuild; `tsgo` is only used for type checking.

```bash
pnpm typecheck   # type-check with tsgo (no emit)
```

## Build

```bash
pnpm build     # tsgo type-check, then vite build to dist/
pnpm preview   # preview the production build
```
