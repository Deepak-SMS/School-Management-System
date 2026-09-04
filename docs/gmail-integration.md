# Gmail Integration Setup

How to connect a real Gmail account to the Email Campaigns module (`/communication/email`). Every school connects its own Gmail account — nothing is shared across tenants, and no password is ever entered into this app (Google's own consent screen handles authentication; this app only ever sees an OAuth token).

## 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (or reuse an existing one) for this app.
2. Under **APIs & Services → Library**, search for **Gmail API** and click **Enable**.

## 2. Configure the OAuth consent screen

Under **APIs & Services → OAuth consent screen**:

1. User type: **External** (unless every school using this belongs to the same Google Workspace organization, in which case **Internal** is simpler).
2. Fill in the app name, support email, and developer contact.
3. Scopes: add `https://www.googleapis.com/auth/gmail.send` — the only scope this app requests. It grants permission to send email as the connected account; it does **not** grant read access to the mailbox.
4. Test users: while the app is in "Testing" status, add every Gmail address that will connect a school (e.g. the accounts you're testing with). Google caps unverified apps to 100 test users and expires their tokens after 7 days — fine for development, not for production (see §5).

## 3. Create OAuth 2.0 credentials

Under **APIs & Services → Credentials → Create Credentials → OAuth client ID**:

1. Application type: **Web application**.
2. Authorized redirect URIs — add exactly:
   - `http://localhost:3000/api/email/gmail/callback` for local development
   - `https://<your-production-domain>/api/email/gmail/callback` for production
3. Save. Copy the **Client ID** and **Client secret**.

## 4. Set environment variables

Add to `.env` (see the commented-out block already there):

```
GOOGLE_CLIENT_ID="<your client id>"
GOOGLE_CLIENT_SECRET="<your client secret>"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/email/gmail/callback"
TOKEN_ENCRYPTION_KEY="<a random secret — generate with: openssl rand -base64 32>"
```

`TOKEN_ENCRYPTION_KEY` encrypts the stored access/refresh tokens at rest (AES-256-GCM, `src/lib/email-campaigns/token-crypto.ts`) — it's unrelated to Google, just pick any long random string and never commit it.

Restart the dev server after changing `.env` — these are read at request time, not build time, but a running Next.js dev server doesn't reload `.env` on its own.

## 5. Connect a school

1. Sign in as a `super_admin`, `school_admin`, or `principal` and go to **Communication → Email → Settings**.
2. Click **Connect Gmail**. You're redirected to Google's real consent screen — approve the `gmail.send` scope.
3. Google redirects back to `/api/email/gmail/callback`, which exchanges the authorization code for tokens and stores them encrypted against this school's `GmailConnection` row.

If the app is still in Google's "Testing" status, only accounts added as test users in §2 can complete this. Moving to "In production" removes that cap but requires Google's app verification review for the `gmail.send` scope (a sensitive scope) — budget a few days for that if this is going live with real schools.

## Official Google OAuth 2.0 / Gmail API references

- OAuth 2.0 for Web Server Applications (the exact flow this module implements — authorization code grant, `access_type=offline` + `prompt=consent` to reliably receive a refresh token): https://developers.google.com/identity/protocols/oauth2/web-server
- Gmail API scopes reference (`gmail.send` is the minimal, least-privilege scope — it cannot read, search, or delete mail, only send): https://developers.google.com/gmail/api/auth/scopes
- Gmail API `users.messages.send` reference: https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send

## What this module does and doesn't do with your Gmail account

- Sends email **as** the connected account, via the real Gmail API — recipients see it come from the real connected address, in that account's real Sent folder.
- Never reads, searches, or deletes anything in the mailbox — the `gmail.send` scope structurally can't.
- Never stores the Gmail password — only an OAuth token, encrypted at rest, revocable any time from **Communication → Email → Settings → Disconnect Gmail** (which also revokes the token with Google, not just deletes the local row) or from the Google Account's own [Third-party apps & services](https://myaccount.google.com/permissions) page.
- Is subject to Gmail's own sending limits (roughly 500/day for a regular Gmail account, 2,000/day for Google Workspace) — this module does not currently enforce its own lower cap; a 429 from Gmail is retried with backoff like any other transient failure, not silently dropped.
