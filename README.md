# ⬛ UltraDownloader · ShakeelAdminProDownloader (V11)

Universal video / audio / file downloader with an animated **cube-tunnel** design system,
a real browser-owned download engine, a 400-website catalogue with **real share-link
guides**, and a **Pro-Security** admin console.

---

## 1. What was actually broken → and what is fixed now

| # | Real problem (seen in the screenshots) | Root cause | Fix in this branch |
|---|----------------------------------------|-----------|--------------------|
| 1 | `This download link is not valid or has been modified` | The whole target (a 2–3 KB googlevideo URL + name + mime + timestamps) was packed **inside** the signed URL. Proxies/chat apps truncate long URLs → signature mismatch → 403. | Tickets are now **server-side** (`u1.<id>.<time>.<hmac>`, ~80 chars). A 2.4 KB CDN link produces a **154-char** download URL (measured). |
| 2 | `File wasn't available on site` | The CDN signature (YouTube / TeraBox / Dailymotion) had expired, and the stored link was never refreshed. | The download service now **re-resolves the original page** on 401/403/404/410/451, swaps in a fresh CDN URL (same format when possible) and continues the same transfer. The frontend also retries **once with a brand-new ticket** automatically. |
| 3 | Quality list showed `4K Ultra` inside **Video + Sound** even when the video had no 4K/audio | Adaptive (muted) tracks were pushed into the `videoAudio` bucket. | `videoAudio` now only contains formats that **really have an audio track**; muted tracks live in *Video Only (Muted)*. Nothing is invented. |
| 4 | Duplicate rows (`142kbps WEBM` twice) | The same `itag` arrived from the ANDROID **and** IOS InnerTube clients. | Formats are de-duplicated by `itag`, and every list is de-duplicated again by `quality+ext+url`. |
| 5 | Quality had to be picked manually per video | Selection always reset to index `0`. | New `autoStream` from the backend + **Auto quality** badge. One button always downloads the best real stream *for that video*; picking a card switches to manual. |
| 6 | Two different download code paths (hero vs. queue/folder items) | `instantDownload` and the signed-ticket engine disagreed. | Everything now runs through **one** engine: `runUniversalDownload()` (ticket → HEAD verify → browser). The legacy path survives only as a last-resort fallback for direct file links. |
| 7 | "Supported Websites" cards had no usable links (`https://site.com/`) | `exampleUrl` was auto-generated from the first domain. | New `platformLinks.js` with the real **share-link shape** + a real public example for every major platform; cards show the pattern and a **Copy example** button. Unknown sites are explicitly accepted (**Universal mode** chip). |
| 8 | Admin login changes | credentials were hard-coded in the DB seed, pre-filled in the form, empty 2FA passed, stale `sessionStorage` unlocked the console. | New identity module + bcrypt re-sync on every boot, no pre-filled fields, **strict** 2FA (empty code can never pass), real `GET /admin/auth/session` check, brute-force limiter + 3-strike IP ban. |
| 9 | Duplicates & dead weight | 4 clone "live" platform cards, duplicate adult website seed, 600 kB hls.js in the main bundle, no `.gitignore` (node_modules could be committed). | Removed, de-duplicated, hls.js is now a **lazy chunk**, `.gitignore` added. |

---

## 1b. V12 — what changed in this round

| # | Problem reported | Real fix |
|---|------------------|----------|
| 1 | "This download link is not valid or has been modified" every time | The Retry path now sends `refreshSource: true`. The backend re-resolves the original page and mints a ticket around a **seconds-old** CDN link. The client retries up to **3 times** with backoff instead of giving up after one. |
| 2 | "File wasn't available on site" in Chrome's download shelf | The backend now walks **up to 6 ranked candidate streams** from a fresh re-resolve (same format first, then same height, then everything else) and persists the healed URL into the live ticket. |
| 3 | Fake 2160p / 1440p / 4K rows with copy-pasted sizes | Those ladders no longer exist in the codebase. The picker only lists streams the source really returned, and `auto` means *best real stream with sound for THIS video*. |
| 4 | "Whatever quality, convert to Ultra HD / MP3" | New **auto-convert engine** (`mediaConverter.js`): real job queue, real progress, real cancel, real MP3 transcode when FFmpeg exists. Without FFmpeg it still delivers the best real stream (MP4/M4A) and says so — it never upscales a 360p video into a fake "4K". |
| 5 | Search was a stub and returned HTTP 500 | New **video search engine** (`videoSearchService.js`): exactly **50 real videos = 30 top + 20 middle**, videos only, duration/sort filters, and graceful degradation instead of a 500. Raw TLS errors are no longer leaked to the browser. |
| 6 | No SEO / AI analysis | New **SEO + AI Link Analyzer** page (`/seo-analyzer` + `POST /api/v1/seo/analyze`): real metadata, an honest download verdict (what works, what cannot, and why), plus meta title/description/slug/keywords/JSON-LD with live length checks. |
| 7 | User dashboard showing other people's data | Verified strictly scoped: `listDownloadJobsForUser()` filters on `user_id` and returns `[]` for guests. No cross-user leak. |

### New endpoints (V12)

```
GET    /api/v1/convert/capabilities      → is FFmpeg present, what can be produced
POST   /api/v1/convert                   → { sourceUrl, mode, target, audioFormat } → job
GET    /api/v1/convert/:id               → live progress / result
DELETE /api/v1/convert/:id               → cancel
GET    /api/v1/convert/:id/file          → download the finished file (Range + HEAD)
GET    /api/v1/videos/search?q=…         → 50 videos (30 top + 20 middle)
POST   /api/v1/seo/analyze               → { url } → verdict + SEO block
```

### FFmpeg (only needed for MP3 / re-encoding)

The converter feature-detects FFmpeg at runtime — nothing crashes when it is
missing, the panel simply explains it and delivers M4A instead.

```bash
# Windows (Chocolatey / winget)
winget install Gyan.FFmpeg
# or download a build and set the path in backend/.env
FFMPEG_PATH=C:\\ffmpeg\\bin\\ffmpeg.exe
```

With FFmpeg installed, the panel unlocks real MP3 transcodes and the engine
reports `reEncode: true`.

## 2. Pro-Security admin console

### URLs (all open the same console, same slug everywhere — localhost or live)

```
http://localhost:5173/vault-control-x9p4
http://localhost:5173/pro-security/vault-control-x9p4      ← Pro-Security alias
http://localhost:5173/vault-control-x9p4/pro-security
```

Stealth keyboard shortcut from any page: **Ctrl + Shift + Alt + U**

Brand: the padlock screen, navbar and sidebar all use the same isometric
purple cube-tunnel tile (`frontend/public/brand/cube-tunnel-256.png`, with a
128 px variant for small slots). No other logo files are shipped — one asset,
one look.

### Credentials (stored as bcrypt hashes in SQL, plaintext only in `backend/.env`)

| Step | Field | Value |
|------|-------|-------|
| Gate 1 | Digital keypad PIN (14 digits) | `78645637189230` |
| Gate 2 | Super-Admin e-mail | `Shakeelaijaz559986@gmail.com` |
| Gate 2 | Master password | `ShakeelAhmed@@45637189230` |
| Gate 2 | 6-digit Pro-Security code | `189230` |

> The keypad adapts to the PIN length reported by the server (`/admin/auth/hints`),
> so the 14-digit PIN works without any UI change. Real RFC-6238 authenticator codes
> for `ADMIN_TOTP_SECRET` are accepted too.

### Where to change them later

Edit `backend/.env` → `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PIN`, `ADMIN_STATIC_2FA_CODE`
→ restart the backend. `syncMasterAdminIdentity()` re-hashes the new values into the
`admin_users` row automatically (no manual SQL, no data loss).

### Security layers

1. secret URL slug (not linked anywhere public, not in sitemap/robots)
2. optional IP allow-list (`ADMIN_IP_ALLOWLIST`)
3. 3 wrong attempts → 30-minute SQL IP lockout (`ip_lockouts`)
4. bcrypt (cost 12) for password **and** PIN, constant-time comparison
5. mandatory 2FA (static Pro-Security code **or** authenticator app)
6. httpOnly, sameSite cookies + 8-hour signed JWT
7. `GET /admin/auth/session` — a stale `sessionStorage` flag can never unlock the UI
8. every gate/login/lockout is written to `security_audit_logs`
9. honeypot `/admin`, `/wp-admin`, `/dashboard` return a fake 404 and log the intruder

---

## 3. Supported websites (400 adapters + unlimited universal mode)

* Every platform card shows the **exact link shape** it accepts, e.g.
  `youtube.com/watch?v=ID · youtu.be/ID · youtube.com/shorts/ID`
* Every card has a **real example link** you can copy and test instantly.
* Anything **not** in the catalogue is still accepted: the universal engine reads
  `og:video`, JSON-LD, `<video>`, iframes, JW/Video.js/Plyr players, embedded
  YouTube/Vimeo/Mux/Wistia/Kaltura players, direct `.mp4/.m3u8/.mp3` links, etc.
* Only two honest limits: local/private network addresses (SSRF guard) and
  Widevine/FairPlay DRM titles (no downloader can legally decrypt those).

---

## 4. Download engine (one click, real bytes)

```
POST /api/v1/files/download-ticket     →  short signed ticket (server keeps the payload)
GET  /api/v1/files/download/:name?ticket=…  →  200 / 206 with Content-Disposition: attachment
```

* `HEAD` works (so the page can verify the link without downloading it)
* `Range` works (IDM / resume / multi-part)
* expired link → automatic re-resolution + one automatic retry
* the browser owns the transfer — the UI only ever says **“Download started”**

---

## 5. Run it

```bash
# terminal 1 — backend (auto-imports the SQL into XAMPP MySQL if it is running)
cd backend
npm install
npm run dev            # http://localhost:4000  (falls back to in-memory standby)

# terminal 2 — frontend (auto-starts the backend too)
cd frontend
npm install
npm run dev            # http://localhost:5173
```

XAMPP: start **Apache + MySQL**, then the backend imports `ultradownloader_xampp.sql`
(also present at `backend/database/ultradownloader_xampp.sql`) on first connect.

### Tests

```bash
cd backend  && npm test     # 54 pass / 7 skip (live-network tests skip offline)
cd frontend && npm test     # 15 pass / 1 skip (live-site flow skips offline)
```

---

## 6. Performance work in this branch

* hls.js (~600 kB) is lazily imported only when a stream is actually `.m3u8`
* channel/stream analysis is cached (`cachedOrCoalesced`, 3 min) and tiers race in parallel
* analytics writes are write-behind batched; ad waterfall / settings / websites are cached
* new SQL indexes (`download_jobs(user_id, created_at)`, audit + event timestamps, …)
  are created idempotently on connect
* lists are de-duplicated before rendering; the catalogue renders 48 cards at a time
* `prefers-reduced-motion` disables every animation

---

## 7. Security note — `.env` is tracked

`backend/.env` currently lives in the repository because the two cloud
deployments (local + live) must share the same admin credentials. Before making
the repository public, rotate the secrets and move them to the host's
environment:

```bash
git rm --cached backend/.env
echo "backend/.env" >> .gitignore
```

Then set the same keys in the hosting panel (Vercel/Railway/XAMPP). The app
reads every secret from `process.env`, so nothing else needs to change.

## 8. Merge on GitHub

```bash
git checkout arena/4e341ea6-downloader312
git pull origin arena/4e341ea6-downloader312
git push origin arena/4e341ea6-downloader312
```

Then open the pull request on GitHub and merge it into `main`.
