# Aahvaanam Kitchen: Netlify + MongoDB Atlas setup

This guide uses **Netlify hosting** for the Next.js app and **MongoDB Atlas M0** for data. Keep all secrets out of GitHub, screenshots, support chats, and the public website. A working Netlify URL does **not** prove Atlas connectivity or administrator login.

## 1. Atlas database

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com/). Use project `aahvaanamkitchen`, cluster `Cluster0` (M0 free tier).
2. Under **Database Access**, create a dedicated database user with **readWrite** access only to `aahvaanam_kitchen`. Use a unique strong password. This user is **not** your Atlas website account.
3. Under **Network Access**, allow Netlify's outbound connections. Standard serverless deployments may have changing outbound IPs; a temporary `0.0.0.0/0` allowlist is sometimes needed. This allows network attempts from anywhere, so secure the database account, restrict its permissions, and prefer a restricted/private network path if available.
4. In **Cluster0 → Connect → Drivers**, select **Node.js** and copy the `mongodb+srv://...` URI. Replace the user and password placeholders; URL-encode special characters in the password. Never commit the URI.

## 2. Netlify environment variables

Open **Netlify → your project → Project configuration → Environment variables** and add these for production/server functions:

| Name | Value |
|---|---|
| `MONGODB_URI` | Private Atlas driver URI |
| `MONGODB_DB_NAME` | `aahvaanam_kitchen` |
| `ADMIN_EMAIL` | Your administrator email address |
| `ADMIN_PASSWORD_HASH` | Scrypt hash from `npm run admin:hash` |
| `SESSION_SECRET` | Random secret from the same command, at least 32 characters |

Do **not** set `ADMIN_PASSWORD_HASH` to your plain-text password. Do not use a password from a shared computer or paste it into chat. Netlify must provide these variables at **runtime** to the serverless functions, not merely to the browser build.

After saving, trigger a **new production deploy** in Netlify. Check `/admin`: it should redirect to `/admin/login` once the configuration is present. If it still shows **Administrator setup required**, check spelling, scopes, and whether a new deploy was triggered.

## 3. Generate credentials locally

On a trusted machine with Node.js 22:

```sh
git clone https://github.com/sneela/aahvaanamkitchen.git
cd aahvaanamkitchen
git switch feature/mongodb-free-tier
npm install
npm run admin:hash
```

The script asks for a password twice **without echoing the input** and prints `ADMIN_PASSWORD_HASH` and `SESSION_SECRET`. Store them directly in Netlify. Do not save these outputs in source control.

## 4. Seed the database and create indexes

Create a private `.env.local` in the local project (already ignored by Git), containing `MONGODB_URI` and `MONGODB_DB_NAME`. Node 22 can load this file explicitly for standalone scripts:

```sh
node --env-file=.env.local scripts/mongodb-indexes.mjs
node --env-file=.env.local scripts/seed-mongodb.mjs
node --env-file=.env.local scripts/verify-mongodb.mjs
```

The seed is **non-destructive**: it creates missing products, categories and default settings without overwriting existing edits. Default ordering and delivery settings remain **disabled**. The verification command tests Atlas connectivity and permissions without printing the URI. Do not use the integration test against Atlas; it is designed for a disposable **local** MongoDB instance only.

If a local connection fails, check the Atlas database user's password, network access list, and URL-encoding of special characters.

## 5. Verify before accepting real orders

- Open `/api/storefront` and confirm `connected: true`, populated products, and disabled ordering.
- Open `/admin/login`, sign in, and verify the dashboard loads. Confirm a logged-out user cannot access the administrator API.
- Check menu, categories, prices, preorder notices, delivery minimum and fee, specials, catering inquiries, review moderation, and sign-out.
- Submit a **test** order only after deliberately enabling ordering in the admin dashboard; verify it is stored as **pending** and **unpaid**, with server-computed prices. Disable ordering again until business/legal launch checks are complete.
- Replace placeholder food photos with your own or properly licensed images before public launch. Check applicable Ohio food-service licensing requirements before accepting real orders.

## 6. Domain and costs

The site can remain at its `*.netlify.app` address until ready. To connect `aahvaanamkitchen.com`, either retain Namecheap DNS and use the records **Netlify displays for your project**, or switch the domain's nameservers to Netlify DNS. Preserve any existing MX/TXT records for email. Netlify DNS and managed HTTPS certificates do not require a separate DNS subscription on the Free plan; free hosting and Atlas M0 have usage limits. Domain renewal at Namecheap is separate.

Official docs: [Netlify Next.js](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [Netlify external DNS](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/), [Atlas connection](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).

## 7. Troubleshooting: 401 on the production domain

A `401` from `POST /api/auth/login` means the login endpoint rejected the submitted credentials; it is **not** proof of a successful MongoDB write or a verified production login. A `500` with `MongoServerSelectionError` indicates a separate Atlas network/TLS failure during rate limiting. A `503` indicates missing server configuration and a `429` indicates too many attempts.

From the deployment containing the November 2 login-diagnostics improvement onward, every rejected login produces a **sanitized private Netlify Functions log** entry named `Admin login denied` with a reason category and a random `trace`. The browser still sees only `Invalid email or password`; the response has an `X-Auth-Trace` header and the sign-in page shows the same reference. Match that reference to the Functions log for the *same production deploy* (not Build logs or deploy-preview logs). No email, password, password hash, URI or session token is logged. Older deployments require `AUTH_LOGIN_DIAGNOSTICS=1` and a redeploy for the equivalent private reason log.

Reason categories:

- `hash_format_invalid`: `ADMIN_PASSWORD_HASH` is not exactly a hex salt, colon, and 128 hex characters. Use **only the hash value**, not `ADMIN_PASSWORD_HASH=` or surrounding quotes.
- `password_mismatch`: the password entered is not the password from which the deployed hash was generated. Re-run `npm run admin:hash` privately, replace the hash in the same production deploy context, and deploy again.
- `email_mismatch`: the password matched but the submitted email differs from `ADMIN_EMAIL` in the deployed function. Verify the exact email and environment context.

If the new `X-Auth-Trace` header is missing, the domain is likely still serving an older build, a different Netlify site/branch, or a proxy response. Check the production deploy's **published commit** and compare it with the commit containing this improvement before troubleshooting credentials. Netlify environment variables may be scoped separately to Production and Deploy Previews; ensure the server runtime has access. **Never paste secret values into a support message or public issue.**

The local unit tests check valid and invalid scrypt hashes, email normalization, whitespace-sensitive passwords and malformed hashes. These tests **cannot** validate private Netlify values or the actual production domain. Do not turn on ordering until the live login, logout and administrative workflows have been verified.

### Diagnosing an unexpected 500 without leaking secrets

Starting with the November 3 feature-branch update, unexpected login exceptions are logged privately as `Admin login server failure` with `reason: unexpected_server_error` and an `X-Auth-Trace` correlation ID. The raw MongoDB exception is intentionally not logged because it may contain connection details. A 500 requires checking Atlas/Netlify runtime connectivity separately; it does **not** prove a password mismatch. The log change is only available on the deployment that contains this commit, not automatically on an older `main` deploy. Never paste request payloads, cookies, database URIs, or secret values into support chats.
