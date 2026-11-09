# Fire & Water

A mobile-first personal party website. React/Vite on Vercel Hobby, Cloudinary Free, no database and no paid API. Guest site `/`, slideshow `/screen`, host studio `/admin`, printable QR `/qr`.

## Current verification status

- Production build succeeds.
- Seven automated tests exercise authentication, CSRF, consent, JPEG upload validation, 300 simultaneous requests (Cloudinary mocked), moderation, deletion, upload pause, export, listing over 1,500 photos, and offline cache replay/eviction/removal.
- Desktop Chromium review completed for home, navigation, info, and the protected upload setup state.
- Live Cloudinary storage, Vercel capacity, QR scanning on actual phones, iOS Safari, Android Chrome, and live offline slideshow acceptance still require the configured deployment. A mocked provider test is not a Cloudinary/Vercel load test.
- No paid service, subscription, credit card, or database has been configured.

## Run locally

Use Node 22 or 24. `npm ci`, then `npm run dev`. The dev server defaults to localhost:5173 and accepts `--port`. Without server environment variables the website opens in setup mode, with uploads disabled. To run configured locally, export the variables from `.env.example` into the process environment, or use `node --env-file=.env.local dev.mjs`. The dev script does not automatically load an env file into the API process.

## Deployment

1. Create a new personal GitHub repository and push this directory. Do not reuse an unrelated repository. Keep `.env` files out of Git.
2. Create a Vercel project on **Hobby**, importing that repository (or deploy these source files through the Vercel API). Framework: Vite; build `npm run build`; output `dist`; Node 22 or 24. The included `vercel.json` routes API requests and the SPA.
3. In Vercel's server-side production environment, configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `GUEST_CODE`, `EVENT_ID`, and `APP_ORIGIN`. None have a `VITE_` prefix. Never paste secrets into a GitHub file or client code.
4. Generate independent random host and session secrets (e.g. `openssl rand -hex 32`). Host password minimum 16 characters, session secret minimum 32, guest code minimum 6. `EVENT_ID` is lower-case letters, digits and hyphens, at most 40 characters. `APP_ORIGIN` is the exact production HTTPS origin without trailing slash.
5. Use a free Cloudinary account with no unsigned upload preset. Authenticated image and raw asset uploads, signed delivery, Admin API resource listings, and raw private downloads must be enabled. The app creates its settings JSON on first Save. Pending images are uploaded with `type: authenticated`; never make that folder publicly accessible or configure an anonymous access window.
6. Redeploy after changing environment variables. `/api/health` must say `configured: true`. This confirms variable presence/length only, not credential validity; perform an upload and settings save to verify Cloudinary.
7. Production guest pages must be public to visitors without Vercel login. Preview deployments may remain protected. Test the production URL in a signed-out browser.

## Host guide

- Open `/admin`; use the host password. Eight-hour HttpOnly, Secure, SameSite=Strict cookies protect server actions.
- Edit provisional event details, schedule, consent/removal text and upload/approval switches. Press **Save event settings**.
- Manual approval is the default. Refresh the host photo list, review thumbnails, approve individually or up to 50 in a batch. Auto-approve applies only to future uploads.
- Share the event code privately with guests. The QR contains only the guest website URL. Guests enter the code, select up to five photos, and consent.
- Open `/screen` on the display computer. Full screen uses the browser API where available; on iOS use the browser's available display controls. Keep the tab visible and device awake. No autoplay audio is used.
- The screen polls every 30 seconds. Cached lists can add up to roughly 30 seconds of discovery delay, so allow about a minute after moderation. New IDs are prioritized, followed by shuffled rotation; every fifth slide can be a three-photo collage. Each slide lasts eight seconds.
- Removal deletes the cloud copy and requests CDN invalidation. Connected screens drop it on the next successful list refresh. The app cannot recall downloaded images, screen captures, third-party caches, or offline copies before reconnection. Never promise immediate universal revocation.
- The slideshow saves up to 80 optimized photos in the browser cache. Offline playback covers photos successfully cached on that device. A fresh disconnected device has no images. Browser quota, private mode, low storage, browser eviction and OS suspension can limit persistence. Reconnecting purges removed IDs.
- `/qr` prints or downloads a high-resolution QR. Generate it only from the final guest URL. Test it on an actual phone before printing.
- Export all photo URLs as JSON, or download ZIP batches of up to 50 filtered photos. Downloads are optimized event copies; original phone-resolution files are intentionally not retained. The JSON can contain private review URLs: keep it with the host.
- Use **Check Cloudinary usage** to inspect account-wide usage (cached five minutes). Watch the Cloudinary and Vercel dashboards during the event and pause uploads if headroom becomes low. Export and set a deletion date after the party.

## Free-tier estimate — not a guarantee

Cloudinary currently publishes 25 shared credits, not separate 25 GB storage and delivery allowances. Source: https://cloudinary.com/pricing and https://cloudinary.com/documentation/billing_and_plans . Vercel Hobby is for personal noncommercial use: https://vercel.com/docs/plans/hobby . Recheck current account allowances before the event.

- Each client JPEG is limited to 600 KiB; both client and server resize to at most 1600 pixels on the longest side. The server re-encodes and strips metadata. Original phone images are not stored.
- At 300 KB average, 1,500 optimized originals total about 450 MB. The accepted client-size ceiling corresponds to about 0.92 GB before server re-encoding; server output varies with image complexity. Add thumbnails/derived storage.
- One 480px thumbnail rendition per photo is roughly 1,500 transformations, or 1.5 credits at 1,000 transformations/credit. There may be other account transformations; inspect real usage.
- 300 guests viewing 100 thumbnails at 50 KB each is about 1.5 GB delivered. Viewing every one of 1,500 thumbnails would be about 22.5 GB before full photos, uploads, screen traffic or other projects: that is **not comfortably within** the free tier. Gallery loads 24 at a time.
- One screen displaying a 300 KB photo every eight seconds for eight hours would deliver roughly 1.08 GB before caching. The 80-photo local cache reduces repeated downloads; a 1,500-photo rotation exceeds that cache and can download again later.
- An ordinary one-night event with limited browsing should fit the image-credit budget with room to spare. Unlimited browsing, repeated exports, many screens, existing account usage, or abuse can exhaust it. No upgrade or credit card is required by this app. Hobby services can stop serving when included limits are reached.
- Admin API rate limits are a separate constraint. At 1,500 photos a full list takes three paginated requests. Cache TTL is 25 seconds, shared through Vercel Runtime Cache in production; local coalescing prevents duplicate work within an instance. Cold/evicted shared-cache misses and simultaneous cache expiry can still multiply origin calls. Monitor Cloudinary API rate limits; do not run aggressive polling load tests against its free Admin API.

## Security and operational limits

Backend-mediated signed Cloudinary uploads keep all upload signatures and secrets server-side, rather than issuing reusable client upload signatures. There is no unsigned preset. Re-encoding rejects non-JPEG content and caps input pixels. Pending assets receive no guest-facing signed URL. Signed approved URLs are bearer links and can be shared by recipients.

A signed guest cookie provides five non-overwritable public IDs per session, plus a private event code. This is a best-effort abuse barrier, not a strict five-per-human quota: clearing cookies, using another browser, or learning the shared code can obtain a new session. In-memory login throttles are per instance, not a globally enforced rate limit. Strict distributed guest quotas or guaranteed hard total-photo caps would require durable atomic state (a database or equivalent). Those are intentionally not claimed. Use a strong private code, manual approval, and the upload switch. Additional platform firewall protection can be configured if needed without introducing a paid plan.

Settings are a small authenticated raw Cloudinary JSON asset, intended for one host editing at a time. Multiple simultaneous host saves use last-writer-wins. Moderation uses atomic tag operations, with Cloudinary as the durable source of truth. Cache is never the sole copy of settings or image data. No database is required for this event scope.

## Live acceptance checklist

1. Scan `/qr` on iOS Safari and Android Chrome, signed out of Vercel.
2. Upload a real phone JPEG and supported HEIC through Safari's image decoder; unsupported formats show a conversion message. Confirm saved dimensions, bytes, and metadata stripping.
3. Try wrong codes, missing consent, oversize/invalid content and direct unauthorized admin requests.
4. Confirm pending photo IDs and URLs are absent from `/api/photos`, and unsigned Cloudinary delivery cannot retrieve them.
5. Approve; verify automatic screen discovery. Upload with auto-approve enabled and verify again.
6. Keep screen playing, disconnect Wi-Fi, then reconnect. Remove a cached photo from another device; confirm it is purged on screen reconnection.
7. Test parallel real uploads with a small disclosed test batch first; scale carefully while watching Cloudinary credits, API limits, Vercel CPU/invocations and response errors. Mock tests do not establish production throughput.
8. Export a ZIP, pause uploads and confirm rejections, resume and retry. Open a saved QR from paper.
9. Keep this checklist pending until performed against the live configured service. Delete test assets afterward only when authorized.
