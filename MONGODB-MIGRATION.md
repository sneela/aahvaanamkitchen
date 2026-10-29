# MongoDB Atlas migration — active development

Project: `aahvaanamkitchen` / `Cluster0` / `aahvaanam_kitchen`.

MongoDB backend code is being pushed incrementally to `feature/mongodb-free-tier`. The backend includes server-only connection, schema types, indexes, seed, order requests, catering, reviews, specials, settings and secure admin sessions. **This branch is not ready to deploy** because the original storefront, admin dashboard, CSS, and binary branding assets have not yet been fully restored to GitHub.

The separate development ZIP contains the original storefront, cart, admin UI, emblem, catalog PDF and MongoDB implementation. No live Atlas credentials or production deployment have been used.

Before production: finish GitHub asset/UI sync, run `npm install`, `npm run typecheck`, `npm run build`, connect a test Atlas cluster, run indexes/seed, verify admin login and full checkout/review/catering workflows. Keep ordering disabled until food-business licensing and operating policies are confirmed.

Commercial-compatible free-tier hosting candidate: Netlify Free (see README). Vercel Hobby prohibits commercial use.
