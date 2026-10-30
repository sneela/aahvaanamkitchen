# Google Sites and Netlify connection guide

**Status (October 30, 2026):** The owner reports a reachable Netlify URL at https://aahvaanamkitchen.netlify.app, but live Atlas, administrator sign-in, and custom-domain DNS have not been independently verified. Keep `ordering_enabled=false` until private verification and applicable food-business requirements are complete.

## Recommended setup

- **Storefront and checkout:** Next.js application on Netlify, using server-side API routes and MongoDB Atlas. Use the owner-reported Netlify URL for testing before connecting the custom domain.
- **Existing Google Sites page (optional):** A landing page with buttons to the Next.js storefront, current menu, catering and WhatsApp.
- **Domain:** If you control `aahvaanamkitchen.com`, point it to the deployed Next.js site only after testing. Do not change existing DNS or email records without checking their current values.

Google Sites cannot host Next.js route handlers, server-side authentication, or MongoDB connections. Do **not** paste the private MongoDB URI, admin credentials, or session secret into Google Sites or browser JavaScript.

## Steps

1. In Netlify, import GitHub repository `sneela/aahvaanamkitchen`. Choose `feature/mongodb-free-tier` for a preview. Confirm the Netlify Next.js runtime supports the App Router and Node.js API routes.
2. Configure `MONGODB_URI`, `MONGODB_DB_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` as **private server-side environment variables** in Netlify. Generate hashes/secrets locally; never commit them.
3. Run the Atlas indexes/seed and private connectivity check as described in [NETLIFY-ATLAS-SETUP.md](NETLIFY-ATLAS-SETUP.md). Verify the preview website, order requests, administrator login/logout, pricing, delivery, catering, reviews, and specials using test data.
4. Confirm that the preview site is HTTPS and that `/admin` and `/api/admin` reject unauthenticated requests. Check the privacy notice and business licensing before taking real orders.
5. In Google Sites, choose **Insert → Button**, enter a label such as **Order / Browse menu**, and link to the verified Netlify storefront URL. Add separate buttons for `/catalog` and `/#catering` if desired. Publish the Google Site.
6. **Do not embed the admin dashboard in an iframe.** Linking to the hosted storefront is more reliable than embedding checkout in Google Sites, especially with cookie and cross-origin restrictions.
7. Once the custom domain is attached to Netlify and DNS/HTTPS are verified, update the Google Sites buttons to the canonical domain. Avoid publishing duplicate order forms that cannot save requests.

## Pre-launch checks

- [ ] Atlas Cluster0 private connection, least-privilege user and network access verified
- [ ] Local MongoDB integration and GitHub Actions CI pass on the final commit
- [ ] Desktop/mobile browser checks pass and screenshots are reviewed
- [ ] Current menu, pre-order notices, delivery fees, WhatsApp number and service area confirmed
- [ ] Original/authorized product photographs replace illustrative placeholders
- [ ] Admin password/session secret set privately, no secrets in GitHub or frontend
- [ ] Domain, HTTPS, privacy/retention and food-business compliance reviewed
- [ ] Website ordering enabled only after the above checks

## Troubleshooting

- **Menu says unavailable:** Check Netlify function logs, Atlas connectivity and `MONGODB_URI`. Do not turn on ordering while the database is unreachable.
- **Sign-in fails:** Confirm the administrator environment variables and that secure cookies are being set over HTTPS.
- **Google Sites checkout does not work:** Use a direct button to the Next.js storefront instead of embedding a page with cross-origin restrictions.
- **PDF prices differ from current prices:** The original flyer is a static reference. `/catalog` reads current available products and prices from MongoDB when connected.

Reference documentation: [Netlify Next.js](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) and [Google Sites Help](https://support.google.com/sites/).
