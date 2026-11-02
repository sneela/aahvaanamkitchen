# Aahvaanam Kitchen development release status — November 2, 2026

**Repository:** `sneela/aahvaanamkitchen`  
**Development branch:** `feature/mongodb-free-tier`  
**Production status:** **NOT VERIFIED / NOT APPROVED FOR LIVE ORDERS**

## Changes made November 2

- PR #8 (admin WhatsApp click-to-chat) was merged into `main` and synchronized into the feature branch through PR #10. Admin order rows now offer chat-only and editable prefilled WhatsApp drafts, without automatic sending or paid API requirements.
- Added a pure scrypt credential verifier with five unit tests covering correct login, email case/whitespace, byte-sensitive passwords, wrong email and malformed hashes.
- A failed admin login now produces a private, sanitized `Admin login denied` log entry with a reason category and random trace. The browser response remains generic (`401`) but includes the trace as an `X-Auth-Trace` response header and displays the reference on the sign-in page. No passwords, emails, hashes, cookies or connection strings are logged.
- Documented how to distinguish a credential mismatch (`401`) from MongoDB TLS/network failure (`500`), missing configuration (`503`) and rate limiting (`429`). Operators must compare the domain's published commit and deployment context to the source branch.
- Added a login-trace assertion to the isolated MongoDB integration test, strengthened source checks, and configured CI to run on `main` pushes once the workflow change is merged.
- Preserved the original owner-supplied branding and two-page catalog in the ZIP. They remain **uncommitted binary originals** in GitHub; optimized web branding remains in the repository.

## Checks actually performed

- Local `npm run verify:source`: **passed**.
- Local `npm run test:logic`: **30 passed, 0 failed** (including five new authentication tests and four WhatsApp tests).
- JavaScript syntax checks for scripts: **passed**.
- Local `npm run audit:launch:strict`: **failed as designed** because 31 seeded menu items still reference illustrative external photos whose rights and dish accuracy have not been confirmed.
- Fresh `npm ci`, `npm run typecheck`, production `npm run build`, browser smoke and isolated MongoDB integration: **not run successfully in this environment** because npm packages are not fully cached and network access is unavailable. The source includes the CI workflow and integration test, but a past CI pass does not validate this revision.
- Live Netlify login on `aahvaanamkitchen.com`, MongoDB Atlas read/write and HTTPS/cookies: **not verified**. The owner recently reported `401 Unauthorized` from the production login; only the operator can verify the deployed private configuration and login with credentials.

## Remaining launch blockers

1. Replace the 31 illustrative external food images with approved original/licensed, dish-accurate photos.
2. Commit/verify the original binary branding assets in GitHub, or use the ZIP originals with an approved upload process.
3. Confirm current menu prices, availability, advance notice, service area, delivery fees, contact details, and legal/food-license/tax requirements.
4. Verify the **deployed branch and commit**, private Netlify environment variable scopes, successful admin login/logout, MongoDB read/write, image uploads, customer order/track, catering, reviews, specials, analytics, and mobile usability on the actual domain.
5. Keep ordering disabled until the live workflow and licensing checks pass. No live deployment or successful production sign-in is claimed.

This is a development source archive, not a production launch certificate.
