# Aahvaanam Kitchen — MongoDB migration (in progress)

This feature branch introduces MongoDB Atlas M0 groundwork. **Not production ready.** Existing ordering/admin APIs still use Supabase until migrated. Do not enable ordering yet.

Included: MongoDB server-only connection, document types, index setup, safe disabled-by-default ordering/delivery settings.

Setup: Create Atlas M0, set server-only MONGODB_URI and MONGODB_DB_NAME, run npm run mongo:indexes. Never commit credentials. Google Sites can link/embed but cannot run Next.js server APIs. Select a free commercial-compatible app host.

Remaining: MongoDB-backed order/admin/storefront APIs, administrator sessions, seed catalog, validation and tests. No deployment or live DB connection has been made.
