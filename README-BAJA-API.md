# CyberBaja API (Vercel)

GitHub Pages still serves the static game (`/mars`, `raid.html`). This folder adds two Vercel serverless routes on the **same repo** so CyberBaja can share a global top-3 board and exchange WebRTC signaling blobs. It is not a game server and does not run a live race loop.

## Deploy (Hobby, no extra domains, no spend)

1. Import this GitHub repo into [Vercel](https://vercel.com) (Hobby).
2. **Root Directory:** leave empty (repo root) so Vercel sees `/api`. Do not set Root to `mars/` — that would hide the functions.
3. **Storage:** Project → Storage → Create → **Upstash Redis** (this is Vercel KV). One click on Hobby. Vercel injects either:
   - `KV_REST_API_URL` + `KV_REST_API_TOKEN`, or
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
4. Redeploy. If those env vars are missing, both routes return `503 {"ok":false,"error":"no-kv"}` and do **not** fake an in-memory board.

The game files are unchanged. Point the client at `https://YOUR-PROJECT.vercel.app` when you wire it.

CORS allowlist: `https://cprahill.github.io`, `http://127.0.0.1:8766`, `http://localhost:8766`, `http://100.92.162.78:8766`, any `http://127.0.0.1:*` / `http://localhost:*`, and Tailscale CGNAT `http://100.64.0.0/10` (Mini play).

## Scoreboard `GET|POST /api/board`

Lane query/body: `planet=mars|moon|earth`, `mode=raid|trial|tour|hunt|free`, `diff=easy|medium|hard|extra`.

Key: `baja:v1:${planet}/${mode}/${diff}`. Max 3 rows. `trial` ranks by lowest `time`; other modes by highest `score`. Same 4-char `A-Z0-9` name is replaced only if the new run is better. A new name is inserted only if it beats 3rd (or the board is short).

```bash
# empty / missing KV
curl -sS 'https://YOUR-PROJECT.vercel.app/api/board?planet=mars&mode=raid&diff=medium'

curl -sS -X POST 'https://YOUR-PROJECT.vercel.app/api/board' \
  -H 'Content-Type: application/json' \
  -d '{"planet":"mars","mode":"raid","diff":"medium","name":"ACE1","score":12000,"coins":8,"time":95000,"place":"1st","cup":"GOLD"}'

curl -sS -X POST 'https://YOUR-PROJECT.vercel.app/api/board' \
  -H 'Content-Type: application/json' \
  -d '{"planet":"mars","mode":"trial","diff":"easy","name":"ACE1","score":0,"coins":0,"time":88000}'
```

## PVP signaling `GET|POST /api/room`

Stores SDP/ICE under `baja:room:ABCD` with a ~2 minute TTL. Two browsers can exchange offers this way. There is no position tick server.

```bash
curl -sS -X POST 'https://YOUR-PROJECT.vercel.app/api/room' \
  -H 'Content-Type: application/json' \
  -d '{"action":"create"}'
# -> {"ok":true,"code":"ABCD"}

curl -sS -X POST 'https://YOUR-PROJECT.vercel.app/api/room' \
  -H 'Content-Type: application/json' \
  -d '{"action":"offer","code":"ABCD","payload":{"type":"offer","sdp":"v=0..."}}'

curl -sS -X POST 'https://YOUR-PROJECT.vercel.app/api/room' \
  -H 'Content-Type: application/json' \
  -d '{"action":"join","code":"ABCD","sdp":{"type":"offer","sdp":"v=0..."}}'

curl -sS -X POST 'https://YOUR-PROJECT.vercel.app/api/room' \
  -H 'Content-Type: application/json' \
  -d '{"action":"ice","code":"ABCD","payload":{"candidate":"candidate:..."}}'

curl -sS 'https://YOUR-PROJECT.vercel.app/api/room?code=ABCD'
```

Local check (no KV expected): `npm test`.

## Paper Desk `GET|POST /api/paper-desk`

Scrubbed live paper blotter for friend-share (`/paper-desk`). No personal fields.

- **GET** — reads KV key `paper-desk:v1:public`. Returns `{ ok, board, paper, signals, updated_at, disclaimer }`.
- **POST** — requires `Authorization: Bearer $PAPER_DESK_PUBLISH_TOKEN` (Vercel env). Body `{ "board": { "paper": {...}, "signals": {...}, "updated_at": "...", "disclaimer": "..." } }`. Strips `burn` / `studio_sprint` / `r1` if present; forces `live_wallets: false`.

Static fallback: `/paper-desk/data/board.json` (may lag until next publish to KV).
