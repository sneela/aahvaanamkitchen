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

The script asks for a password (its input is **visible** in the terminal) and prints `ADMIN_PASSWORD_HASH` and `SESSION_SECRET`. Store them directly in Netlify. Do not save these outputs in source control.

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
