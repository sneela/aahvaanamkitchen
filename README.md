# Aahvaanam Kitchen — development branch

Responsive Next.js 15 / React 19 storefront and MongoDB Atlas backend for `aahvaanamkitchen.com`. **Not deployed, not production-ready, and not connected to a live Atlas database.**

The site has the Aahvaanam temple-inspired logo (optimized web image), a 31-item sample menu, responsive product catalog, cart and checkout request, WhatsApp fallback, catering form, review moderation, published specials, and a protected kitchen dashboard with category management. The printable menu at `/catalog` reads current available items and prices from MongoDB when connected, shows a clearly marked sample when offline, and does not silently show stale prices if the database is unavailable. The original flyer PDF is a static reference and may differ from live pricing. The full-resolution original logo and original catalog PDF are included in the separate development ZIP, not yet committed to this branch. Product photos are illustrative external placeholders; replace with photos you have rights to before launch.

## Local setup

Use Node 22. In Atlas, use project `aahvaanamkitchen`, cluster `Cluster0`, database `aahvaanam_kitchen`, with a dedicated readWrite user. Never paste a MongoDB URI or password into chat or GitHub.

1. Copy `.env.example` to `.env.local`. Set `MONGODB_URI`, `MONGODB_DB_NAME=aahvaanam_kitchen`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `SESSION_SECRET`.
2. Generate the admin scrypt password hash and random session secret locally with `npm run admin:hash`. Store secrets only in the environment.
3. Run `npm install`, `npm run mongo:indexes`, `npm run mongo:seed`, and `npm run mongo:verify` to privately test Atlas ping and read/write access. The verification command does not print the connection string. The seed creates missing products and **disabled** ordering/delivery settings; it does not overwrite later edits.
4. Run `npm run verify:source`, `npm run test:logic`, `npm run typecheck`, `npm run build`, then `npm run dev`. For browser-level desktop/mobile checkout checks, run `npx playwright install chromium` and `npm run smoke:browser` after `npm run build`; the browser smoke saves screenshots in `artifacts/screenshots/`.
5. For local database integration, run `npm run test:integration` **only against a local MongoDB instance**; the script rejects Atlas/cloud URIs and creates/deletes its own temporary test database. Open `http://localhost:3000` and `http://localhost:3000/admin/login`. Verify an unauthorized admin API request is rejected; sign in, edit menu, create a pending order, retry the same request ID, verify server pricing and delivery minimum, approve a review, update specials, and sign out.

No automatic order acceptance, payment collection, delivery routing, emails or SMS are implemented. Public order requests are stored as `pending`/`unpaid`; all fulfillment and payment are handled manually.

## Deployment and Google Sites

Netlify Free publicly permits commercial sites subject to usage limits: https://www.netlify.com/blog/introducing-netlify-free-plan/. Its Next.js integration supports App Router and serverless route handlers: https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/. Connect the repository and use this feature branch for a preview. Add all five environment variables privately in Netlify, **not** in source. Test Atlas connectivity and all workflows before enabling ordering or attaching `aahvaanamkitchen.com`. Set registrar DNS only to values Netlify supplies; preserve existing email records. Free usage limits may apply.

Google Sites cannot run Next.js APIs or MongoDB. Add a link/button to the hosted Next.js site rather than trying to run the checkout or admin inside Google Sites. Do not iframe the administrator area. See [GOOGLE-SITES-INTEGRATION.md](GOOGLE-SITES-INTEGRATION.md) for the step-by-step integration and launch checklist.

## Security and launch requirements

Admin routes require a signed HttpOnly SameSite=Strict cookie, HMAC verification and a server-side administrator check. Login and public submissions use database-backed rate limiting. Order prices and delivery fees are computed on the server. Session secret must be at least 32 characters. Use HTTPS, least-privilege Atlas credentials and network restrictions, and publish privacy/retention information. Review applicable Ohio food business rules and licensing before accepting orders. Replace external placeholder product photos with licensed/original photos. A live Atlas integration test and production deployment remain outstanding.

## API summary

- `GET /api/storefront` — public menu, settings, published specials and approved reviews
- `POST /api/orders` — pending request, server-priced and idempotent
- `POST /api/catering` — inquiry
- `POST /api/reviews` — unapproved review
- `POST /api/auth/login`, `POST /api/auth/logout` — admin sessions
- `GET/POST/PATCH/DELETE /api/admin` — server-side authenticated management

The GitHub Actions workflow has passed source checks, logic tests, TypeScript checking, a Next.js production build, offline HTTP smoke checks, and end-to-end API tests against an isolated local MongoDB service. It also publishes a downloadable source ZIP and browser screenshots as workflow artifacts. These tests do not establish connectivity to your private Atlas Cluster0 or confirm a production deployment. See the latest Actions run for current results.

## Release audit and reverse-proxy security

Run `npm run audit:launch` to list **known static blockers** without failing CI, or `npm run audit:launch:strict` to fail when those blockers remain. The static audit checks for the full-resolution original logo, original catalog PDF, external placeholder photos, default-disabled ordering/delivery, and deployment/privacy documentation. **A passing build or audit does not prove that private Atlas, HTTPS/DNS, licensing, or live order acceptance works.** Verify those separately with your own private environment; do not put credentials in GitHub or chat.

On Netlify, the MongoDB-backed abuse limiter now prioritizes Netlify's `x-nf-client-connection-ip` edge header and validates IP syntax. On other hosts, `x-real-ip` and `x-forwarded-for` are usable **only if the trusted reverse proxy strips and replaces client-supplied values**; do not expose the application server directly while relying on forwarded IP headers. Consider additional platform-level rate-limiting rules for `/api/auth/login`, `/api/orders`, `/api/catering`, and `/api/reviews`. Netlify documents per-IP rate limiting on all plans at https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/.

The original high-resolution images in the separate development ZIP are **not** currently committed to GitHub. Do not mark the release complete until the original assets are committed, licensed product photos replace placeholders, the strict static audit passes, and private production checks are recorded.
