# Aahvaanam Kitchen — Next.js + MongoDB Atlas

## Free WhatsApp messaging from the Admin Orders tab

In **Admin → Orders**, each order has two free actions:

- **Open WhatsApp with message** — opens WhatsApp Web or the phone app with a prefilled, editable message showing the customer's first name, saved order status, order number, itemized dishes, total, scheduled pickup/delivery time and any kitchen status comment. The message is based on the saved database status, not on an unsaved dropdown selection.
- **Open chat only** — opens the same customer's WhatsApp chat without a prewritten message.

Use **Preview / edit WhatsApp message** before opening WhatsApp to customize the text, or **Reset to saved order status** for the standard template. After clicking either link, **you must press Send in WhatsApp**; the website does not automatically send or track message delivery. This is WhatsApp's free click-to-chat mechanism, not the paid Business API. The customer must have WhatsApp on the telephone number they provided at checkout. Domestic US 10-digit numbers are converted to +1 before creating the international WhatsApp link; numbers in other countries should include their country code. The browser must have network access to WhatsApp.

For testing without deployment:

```bash
git fetch origin
git switch feature/admin-whatsapp-messaging
git pull origin feature/admin-whatsapp-messaging
npm install
npm run test:logic
npm run typecheck
npm run dev
```

No additional MongoDB collections, secrets or environmental variables are needed. This feature does not change live ordering behavior or incur WhatsApp API fees. The admin dashboard still requires a valid login and obtains customers' phone numbers only from authorized order records.


## New: popular-item badges, storefront announcements, and anonymous analytics
**Branch:** `feature/mongodb-free-tier` · **Status:** development / not approved for accepting live orders.

This project is a responsive Next.js 15 / React 19 storefront and kitchen administration application for `aahvaanamkitchen.com`. It is designed to use Netlify serverless functions and MongoDB Atlas M0 without requiring a paid database or a payment processor. The owner reported that Netlify can load MongoDB-backed menu items on October 31, 2026; **administrator sign-in remains unverified**. No automated test can validate the owner's private Netlify settings or Atlas credentials.

## Implemented workflows

| Area | Functionality |
|---|---|
| Storefront | Responsive catalog, 31 seeded menu choices in six categories, filtering, cart, request checkout, WhatsApp fallback, printable live menu at `/catalog` |
| Orders | MongoDB-backed pending/unpaid order requests, server-calculated prices and delivery fees, minimum order and advance-notice checks, idempotent request IDs |
| Customer tracking | Order number + checkout phone verification at `/track-order`; displays status and kitchen comment without exposing delivery address |
| Admin | Signed HttpOnly session, rate-limited login, products/categories, availability, prices, delivery/preorder settings, order search/pagination, confirm/reject, payment and fulfillment status |
| Catalog photos | Admin-only JPEG/PNG/WebP uploads stored in MongoDB and served through a controlled image route; avoid excessive uploads on Atlas M0 |
| Customer contact | Catering inquiries, reviews held for moderation, published specials and scheduled top announcements |
| Analytics | First-party daily aggregate visit/product-view/cart/checkout counters and admin 7/30/90-day summaries; no third-party tracker |
| Popularity | Counts distinct non-cancelled saved orders for each item in the last 24 hours; shows a badge at 1+ and stronger styling at 5+ |
| Merchant alerts | Optional Resend email or Twilio SMS/WhatsApp template alerts for new orders only; disabled when credentials are absent |

Payments are **not** collected online. The kitchen must manually confirm orders, payment and fulfillment. Delivery routing, automatic customer messaging, tax calculation and inventory reservation are not included.

## Development setup

Requires Node.js 22 and a local MongoDB instance for integration testing.

```sh
git clone https://github.com/sneela/aahvaanamkitchen.git
cd aahvaanamkitchen
git switch feature/mongodb-free-tier
npm ci
cp .env.example .env.local
npm run admin:hash
```

Privately set `MONGODB_URI`, `MONGODB_DB_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `SESSION_SECRET` in `.env.local`. Never commit or paste credentials into messages. To initialize **your intended database**, explicitly load the environment:

```sh
node --env-file=.env.local scripts/mongodb-indexes.mjs
node --env-file=.env.local scripts/seed-mongodb.mjs
node --env-file=.env.local scripts/verify-mongodb.mjs
```

Seeding inserts missing records without overwriting menu edits. **Ordering and delivery default to disabled.**

### Local checks

```sh
npm run verify:source
npm run audit:launch
npm run test:logic
npm run typecheck
npm run build
npm run smoke:offline
npm run smoke:browser
```

For the isolated API integration test, start a **local** MongoDB instance and run:

```sh
MONGODB_URI=mongodb://127.0.0.1:27017 npm run test:integration
```

The integration script refuses non-local MongoDB URIs and uses a disposable database. The GitHub Actions workflow runs the source checks, logic tests, build, browser smoke, and isolated MongoDB integration checks, and publishes a source ZIP and browser screenshots. A passing CI build **does not** establish a working production deployment.

## Netlify deployment and troubleshooting

Read [NETLIFY-ATLAS-SETUP.md](NETLIFY-ATLAS-SETUP.md). Use Node 22, `npm run build`, and configure secrets for the **Functions** runtime in the correct deploy context. Do not expose server secrets as `NEXT_PUBLIC_*` variables.

If the menu loads but admin login returns `401 Invalid email or password`, the app has reached the login route; check the deployed `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`. For a short private diagnostic, set `AUTH_LOGIN_DIAGNOSTICS=1`, redeploy, attempt one login, and inspect Netlify **Functions logs** for the reason category. The browser response stays generic and no email, password or hash is logged. Remove the diagnostic variable and redeploy after troubleshooting.

Google Sites can link to the Netlify-hosted storefront but cannot host Next.js APIs or the MongoDB backend. Do not embed the admin page in Google Sites. See [GOOGLE-SITES-INTEGRATION.md](GOOGLE-SITES-INTEGRATION.md).

## Release blockers — do not mark complete

Run `npm run audit:launch:strict` as a static release gate. As of November 1, 2026, these items remain:

1. Commit and verify the approved original high-resolution logo and original two-page catalog PDF. The repository currently contains optimized web branding and a small reference PDF, not both originals.
2. Replace all **31 external illustrative food-photo URLs** with original or properly licensed photos; confirm each photo matches its dish.
3. Validate current menu names, prices, preorder notices, delivery areas/fees and customer contact information with the business owner.
4. Privately verify live Netlify admin login, Atlas read/write, production HTTPS/DNS, order submission/tracking, admin edits, image uploads and announcements.
5. Verify applicable Ohio food-business licensing, privacy/retention, and any tax requirements before accepting customer orders.

The static audit is intentionally allowed to report blockers without failing normal CI; strict mode fails until the static blockers are addressed. Keep ordering disabled until all legal, operational and live deployment checks pass.

## November 1 quality fixes

The admin login now preserves whitespace in submitted passwords (the password-hash generator already did). Specials and announcements share a timezone-safe `datetime-local` conversion, avoiding a 4–5-hour schedule shift when an administrator edits a saved special. The Specials API also checks effective start/end ranges on partial updates and rejects empty titles. Automated date conversion tests and local-MongoDB integration assertions cover these regressions; a passing source/CI check is not a substitute for a live Netlify login test.

## Security notes

Admin routes enforce a server-side signed session, same-origin validation for browser writes, and database-backed rate limiting. Customer order totals are recomputed from MongoDB product prices. Review submissions require approval before publication. Use least-privilege Atlas database credentials, HTTPS, a secure network-access policy and Netlify function logs without exposing personal information. Netlify's standard outbound IP addresses can change; do not assume a single permanent Atlas IP allowlist entry will suffice.
