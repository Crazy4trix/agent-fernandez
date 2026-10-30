# Agent Fernandez

Website for Kevin Fernandez, REALTOR®, JRB Dream Team at Real Brokerage. Newnan, GA.

It's a server-rendered Node site with no runtime dependencies (Node's built-in HTTP server, `node:sqlite`, `scrypt`). It includes public listings, buyer, seller and contact inquiry forms, and a password-protected admin for listings, photos and inquiries.

## Run locally

Requires Node 22.13 or later.

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-passphrase' npm start
```

Open http://localhost:3000. The admin is at `/admin`. `ADMIN_EMAIL` and `ADMIN_PASSWORD` create or update the admin account at startup. You can also run `npm run create-admin` for an interactive prompt that doesn't leave the password in shell history.

On first run the database is seeded with **sample listings**. They're labelled "Sample listing" on the public site and "Sample" in the admin, and they're excluded from the sitemap and search indexing. Replace or delete them before launch.

## Test

```bash
npm install
```

```bash
npm test
```

`npm test` starts a throwaway server through the `webapp-testing` skill's `with_server.py` helper and runs `tests/e2e.mjs` (Playwright and axe-core). It covers pages, SEO and branding, security headers, accessibility on desktop and mobile, the forms with and without JavaScript, spam traps, and the admin: auth, throttling, CSRF, listing CRUD, photo upload and validation. Screenshots land in `tests/screenshots/`.

## Configuration

**`config/site.json`** holds brand, name, contact, brokerage and license details. Placeholder values (any phone number containing `000-0000`, and empty license fields) are hidden from the public site until you fill them in.

**Environment variables:**

| Variable | Purpose |
| --- | --- |
| `PORT` | Port to listen on (default 3000) |
| `NODE_ENV=production` | Turns on secure cookies and HSTS |
| `SITE_URL` | Public origin for canonical URLs, sitemap and email links, e.g. `https://agentfernandez.com` |
| `DATA_DIR` | Where the database, uploads and signing key live (default `./data`). Back this up. |
| `TRUST_PROXY=1` | Set when running behind a reverse proxy, so rate limiting sees real client IPs |
| `RESEND_API_KEY`, `EMAIL_FROM` | Turn on inquiry emails (see below) |
| `EMAIL_NOTIFY_TO` | Where notifications go (default: the email in `site.json`) |

## Inquiry emails

Every inquiry is saved and shown in **Admin → Inquiries** whether or not email is set up. To also email Kevin a notification and send the inquirer a branded confirmation, create a [Resend](https://resend.com) account, verify the sending domain, then set:

```bash
RESEND_API_KEY=re_...  EMAIL_FROM='Agent Fernandez <kevin@agentfernandez.com>'
```

Replies go to the inquirer's address. Until a domain mailbox exists, keep `"email": "Kevin@jrbdreamteam.com"` in `site.json`. When `kevin@agentfernandez.com` is live, change that one value.

## Connecting agentfernandez.com

1. Buy the domain. As of 2026-10-30, the .com registry showed no registration for `agentfernandez.com`, `agentfernandezga.com` or `theagentfernandez.com`. That's a lookup, not a reservation, so confirm at checkout.
2. Deploy to any host that runs a long-lived Node process with a persistent disk (a small VPS, Render, Railway or Fly.io). Mount `DATA_DIR` on the persistent disk.
3. Put HTTPS in front. With Caddy on a VPS, the whole config is:
   ```
   agentfernandez.com, www.agentfernandez.com {
     reverse_proxy localhost:3000
   }
   ```
4. DNS at the registrar: an `A` record for `@` pointing at the server's IP (or the host's CNAME/ALIAS target), and `www` as a `CNAME` to `agentfernandez.com`.
5. Start with `NODE_ENV=production SITE_URL=https://agentfernandez.com TRUST_PROXY=1 npm start`.
6. Submit `https://agentfernandez.com/sitemap.xml` in Google Search Console.

## Files

- `server.js`: routes
- `src/`: database, auth, forms, email, views
- `public/`: CSS, JS, self-hosted fonts and sample photography
- `DESIGN.md`: design rationale
- `BRAND.md`: brand rules
- `.claude/skills/`: the two official Anthropic skills used for this build (`frontend-design`, `webapp-testing`), pinned to the commit in `SOURCE_COMMIT`

Sample photography is from Unsplash (Unsplash License). The fonts, Newsreader and Albert Sans, are under the SIL Open Font License.
