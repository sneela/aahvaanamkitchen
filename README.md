# Aahvaanam Kitchen — MongoDB Atlas migration

Next.js App Router + TypeScript. This feature branch is **in progress**, not production-ready. Original branding/catalog assets and full storefront are preserved in the local development ZIP but still require complete synchronization to GitHub. Do not deploy this branch yet.

## MongoDB setup
Atlas project: `aahvaanamkitchen`; cluster: `Cluster0`; AWS us-east-1 M0; database: `aahvaanam_kitchen`.

Keep secrets out of GitHub. Set `MONGODB_URI`, `MONGODB_DB_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `SESSION_SECRET` in your private hosting environment. Run `npm run admin:hash` locally to generate the hash and session secret. Run `npm run mongo:indexes` and `npm run mongo:seed` from a trusted machine after allowing its IP in Atlas Network Access. The seed inserts missing products and settings without overwriting edits. Ordering and delivery start disabled.

## Development
```bash
npm install
npm run verify:source
npm run test:logic
npm run typecheck
npm run build
npm run dev
```
Test login, admin authorization, menu edits, order idempotency, pricing, delivery fees/minimums, Eastern time notice and DST, review moderation and catering before enabling orders.

## Free-tier hosting
Netlify Free permits commercial sites, subject to usage limits: https://www.netlify.com/blog/introducing-netlify-free-plan/. Its Next.js adapter supports App Router and API routes: https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/. Connect GitHub and configure secrets privately under project environment variables; do not put secrets in `netlify.toml`. Vercel Hobby prohibits commercial use: https://vercel.com/docs/limits/fair-use-guidelines.

Google Sites cannot run Next.js APIs. Use a Google Sites button/link to your deployed Next.js domain instead of embedding secure admin or checkout in an iframe.

## Important limitations
No payment collection, automatic acceptance, tax/distance delivery calculation, customer alerts, or live deployment. Admin must manually confirm orders. Customer names/phone/addresses require a privacy and retention policy. Confirm applicable Ohio food-business licenses before accepting orders. Remote food images are placeholders and must be replaced with authorized photos. No npm installation, production build, browser E2E or live MongoDB integration has been verified in this environment.

## Progress
Backend models, indexes, seed, admin session, orders, catering, reviews, specials, settings and DST validation have been implemented. The complete original frontend and binary assets are **not yet fully pushed to GitHub**.
