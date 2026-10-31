# Aahvaanam Kitchen — development branch

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

Developed on `feature/announcements-and-analytics` separately from production. No new paid services, environment variables, databases, or third-party trackers are required.

**Menu popularity (actual orders, rolling 24 hours)**: Products with at least **5 distinct orders** in the previous rolling 24 hours show the exact count on their storefront card and details view. Counts come from the existing MongoDB `orders` collection, with one count per product per order, regardless of quantity. Rejected/cancelled orders do not count. The store API adds `recentOrders24h` per product. New orders record `product_slug_snapshot` to associate future orders with menu products; older orders are counted by their original saved product name where possible. No fake urgency or hard-coded purchase numbers. Refresh the storefront to see updated totals.

**Admin announcements and specials at the top**: Use **Admin → Announcements → Add announcement**, set a title/message and type (**Notice** or **Special offer**), optional same-site link, optional start/end date, display order, and **Publish banner**. Save to MongoDB. Up to three active announcements appear above the website header (highest priority first). You can edit, unpublish, schedule, or delete each independently. Existing **Specials** still appear in the Specials section; announcements are managed separately so you control what is shown at the very top. Times entered through the admin browser are converted to UTC for database storage, then evaluated against the current time.

**Private, first-party analytics**: The site now records only daily aggregate counters for four event types: approximate `visit` (once per browser tab session), `product_view` (clicks to **View details**, once per item per tab session), `add_to_cart` (add clicks), and `checkout_started` (checkout form opens). It does **not** store personal identities, analytics session IDs, contact details, raw browsing events, or third-party tracking cookies. Session storage is used only for browser-side deduplication. Abuse controls use temporary hashed IP buckets separately from analytics data. These counts are not reliable unique-person counts and can be affected by robots or repeated tabs. Actual `ordersPlaced` counts come from the orders collection, not browser submissions.

Use **Admin → Analytics** to inspect the last 7, 30, or 90 days: visit totals, product-detail opens, cart-add clicks, checkout starts, real saved orders, a daily visit chart, and most-viewed products. You can turn collection off in **Admin → Settings → Enable anonymous website analytics**. Turning this off does not delete existing aggregated reports. Times in the report use UTC dates. Because site traffic data is newly collected, historical visitor metrics are not recoverable from the existing orders. The dashboard reflects activity only after this feature is running on the website.

**Indexes and retention:** Once after pulling this branch, run these commands from your project directory (with your *private* local environment):

```bash
git fetch origin
git switch feature/announcements-and-analytics
git pull origin feature/announcements-and-analytics
npm install
node --env-file=.env.local scripts/mongodb-indexes.mjs
npm run typecheck
npm run build
npm run dev
```

The new indexes optimize publishing and daily summaries. An automatic database TTL index removes analytics aggregate records after about 400 days; orders and announcements are not deleted by that TTL. Do **not** run `npm run test:integration` against your existing Atlas database: that test must be run against an isolated **local MongoDB** because it creates and removes test data.

> The development website may connect to the same MongoDB Atlas cluster as production. Announcements and Settings changes save immediately to the connected database, and any records created there may become visible on production when the live version supports them. Keep ordering policies separate from analytics settings. To test without affecting real orders or inventory, configure a separate database such as `aahvaanam_kitchen_test` in your local `.env.local`, and seed it.



## Order submission, customer tracking and merchant alerts (feature branch)

This feature is developed on `feature/order-tracking-and-alerts`, separate from the Netlify production branch. Run locally first:

```bash
git fetch origin
git switch feature/order-tracking-and-alerts
git pull
npm install
npm run typecheck
npm run build
npm run dev
```

When **ordering is enabled by an administrator**, customers can submit their cart and requested pickup/delivery time. The existing `POST /api/orders` validates items against the live MongoDB menu, calculates server-side totals, saves the order as `pending`/`unpaid`, and returns its order number. Duplicate requests with the same request ID return the same number without creating another order. Website orders remain disabled by default until you explicitly enable them in **Settings** after operational/legal readiness checks.

Customers can use the **Track Order** section on the homepage or `/track-order`. The receipt links to the tracker with the order number, and customers enter the **phone number used at checkout**. `POST /api/orders/status` rate-limits lookup attempts and returns itemized totals, status, and kitchen comment only when the order number and phone match. It never returns customer name, delivery address or phone. After confirmation it shows **Confirmed**, after rejection **Rejected** plus the kitchen's reason. This lookup does not send automatic SMS/email to customers.

The **Orders** tab of the kitchen dashboard lists the most recent 100 orders initially, with a **Load older orders** button that fetches additional pages of 100 in a searchable, filterable table, with itemized dishes, quantities, unit prices, totals, requested date/time, customer notes and payment state. You can **Confirm**, **Reject** (a comment is required), or **Save changes** for preparation/delivery/completion status and payment. Customer-visible comments appear when the shopper checks their status. Administrators can also open a manually composed WhatsApp chat with the customer.

### Optional owner notifications

New orders can trigger merchant notifications. All three integrations are **opt-in and disabled until configured**. Notification failures are logged without returning a false order-submission failure. Owner notifications are sent **only for newly saved orders**, not status updates or request retries. For testing, leave notification variables unset to avoid external calls and charges.

**Email (recommended first):** Create an account at https://resend.com and verify a domain you control (including its DNS records). Set `RESEND_API_KEY`, `ORDER_ALERT_FROM_EMAIL` (a sender authorized for your verified domain), and `ORDER_ALERT_EMAIL` (the inbox where you want notifications). Resend has a free tier with usage caps; verify current pricing before enabling. A message includes the order number, contact phone, requested time, itemized details, and amount.

**SMS (optional paid provider):** Configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` and `ORDER_ALERT_SMS_TO`, with approved E.164-format numbers (for example `+1...`). Twilio charges for usage and often for sender number registration/hosting. SMS contains a brief order summary without customers' addresses.

**WhatsApp (optional advanced setup):** With a registered WhatsApp Business sender and an **approved utility template** through Twilio, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `ORDER_ALERT_WHATSAPP_TO`, and `TWILIO_WHATSAPP_TEMPLATE_SID`. The approved template should use `{{1}}` for the order number and `{{2}}` for total. The recipient must opt in to receive WhatsApp messages. WhatsApp/Meta template charges and Twilio messaging fees apply. No attempt is made to send arbitrary unsolicited free-form WhatsApp messages.

Never commit secrets to GitHub. Set your keys locally in `.env.local` and eventually in Netlify Functions environment variables only after testing. Email sender domain verification and Twilio/WhatsApp business verification must be completed outside the code. If none of these integrations is configured, **the database order flow and tracking still work**; simply check the admin dashboard manually.

To test the database API end to end, use `npm run test:integration` **only against an isolated local MongoDB instance**, never your Atlas data. The integration test sets merchant notification credentials to blank. Its database is temporary and is deleted after testing.


## Local testing: catalog editor and photo uploads

The new catalog-management features are developed separately on branch `feature/admin-catalog-image-uploads`. The active Netlify production branch is unchanged until you decide to merge/deploy. If Netlify branch-deploy previews are enabled, turn them off to avoid extra usage.

```bash
git fetch origin
git switch feature/admin-catalog-image-uploads
git pull
npm install
npm run typecheck
npm run build
npm run dev
```

Keep the same private `.env.local` values that worked locally. Sign in at `http://localhost:3000/admin/login`, then open **Menu** or **Categories**.

- **Menu**: browse a horizontally scrollable table of all items, filter by name, edit any row, **Save** or **Cancel**, or delete with confirmation. Price inputs use US dollars; MongoDB continues to store integer cents. The add-item form creates a slug from the item name, so no slug field is required. Existing slugs stay unchanged when names are edited, protecting order references.
- **Photos**: upload JPEG, PNG or WebP in the add-item form or while editing a row. The browser resizes the image to 1200px and converts it to compressed JPEG (max 1.5 MB). Authenticated `POST /api/admin/images` saves it in MongoDB collection `product_images`, then the product record stores only its `/api/images/{id}` URL. `GET /api/images/{id}` serves the image to storefront visitors. No external storage account or new environment variable is required. A photo upload is saved separately from the item: clicking Cancel leaves an unused stored photo. Avoid unnecessary uploads on the free Atlas tier.
- **Categories**: create a new category using only the category name, change its display order and visibility, edit existing categories, and delete empty categories. Categories with linked products cannot be deleted.
- **Security**: uploads require a valid administrator session and same-origin browser request; photo content and size are checked server-side. Website ordering remains disabled by default.

The `npm run test:integration` test is **only for a disposable LOCAL MongoDB server** (never Atlas). It exercises upload authentication, product editing, and category operations. Avoid running this test against your live Atlas data. Ordinary manual testing through `npm run dev` against your configured Atlas database **does write to that database** when you save items, images, or categories.


Responsive Next.js 15 / React 19 storefront and MongoDB Atlas backend for `aahvaanamkitchen.com`. **A Netlify deployment was reported by the owner on October 30, 2026, but live Atlas connectivity, administrator login, and production readiness have not been independently verified.**

The site has the Aahvaanam temple-inspired logo (optimized web image), a 31-item sample menu, responsive product catalog, cart and checkout request, WhatsApp fallback, catering form, review moderation, published specials, and a protected kitchen dashboard with category management. The printable menu at `/catalog` reads current available items and prices from MongoDB when connected, shows a clearly marked sample when offline, and does not silently show stale prices if the database is unavailable. The original flyer PDF is a static reference and may differ from live pricing. The source repository includes the optimized approved logo and printable catalog PDF; full-resolution branding source images are bundled separately in the development ZIP. Product photos are illustrative external placeholders; replace with photos you have rights to before launch.

**New:** Follow [NETLIFY-ATLAS-SETUP.md](NETLIFY-ATLAS-SETUP.md) for the exact five Netlify variables, Atlas access, safe local seeding commands, and launch checklist. The owner-supplied official wordmark is committed at `public/images/aahvaanam-correct-wordmark.webp` and used throughout the storefront and admin.

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
