# MongoDB Atlas migration — verification checklist

Project: `aahvaanamkitchen` · Cluster: `Cluster0` · Database: `aahvaanam_kitchen` (AWS us-east-1 M0).

This feature branch now contains the responsive storefront, menu, cart, pending-order checkout, optimized original emblem, printable catalog, administrator dashboard, catering, review moderation, specials, delivery settings, MongoDB schema/indexes/seed, and GitHub Actions quality checks.

**Not yet live or approved for production.** The source has passed a Next.js production build and TypeScript checks in GitHub Actions. The workflow also tests offline routes and, when successful, a temporary local MongoDB service. This does **not** prove that the private Atlas Cluster0 credentials/network access work or that production hosting has been configured.

## Private Atlas setup

1. Create a readWrite-only database user for `aahvaanam_kitchen`. Use a strong password; keep the URI out of GitHub.
2. Set `MONGODB_URI`, `MONGODB_DB_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` in a private `.env.local` or hosting environment.
3. Run `npm install`, `npm run mongo:indexes`, and `npm run mongo:seed` from a trusted machine with temporary Atlas access.
4. Run `npm run verify:source`, `npm run test:logic`, `npm run typecheck`, `npm run build`, and `npm run smoke:offline`. Use the GitHub Actions results for automated verification.
5. With test orders only, confirm authenticated admin, pending order, duplicate submission, delivery fee/minimum, pre-order notice, catering, review moderation, specials, status changes, and sign-out against Atlas.
6. Only after legal/operational approval, configure Netlify commercial-compatible free hosting and the custom domain. Keep ordering disabled until tested.

## Known gaps

- Live Atlas and hosting deployment have not been verified; no production URL is claimed.
- The original full-resolution logo and original catalog PDF remain in the separate development ZIP. GitHub includes a small optimized version of the emblem and a generated printable menu PDF.
- Food photos are illustrative third-party placeholders; replace with authorized photos before launch.
- Customer email/SMS notifications, online payments, automatic delivery coverage calculations and automated refunds are intentionally not implemented.
- Confirm Ohio food-business licensing, privacy/retention policy, service-area rules and operational readiness before enabling orders.

See [README.md](README.md) for detailed setup and Google Sites linking instructions.
