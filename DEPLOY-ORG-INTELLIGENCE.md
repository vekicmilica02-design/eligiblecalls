# Deploying Organization Intelligence

This package adds Organization Intelligence (organisation profiles, Google sign-in, eligibility matching, Erasmus+ guidelines) to Eligible Calls. It does not contain the Serbia / Western Balkans sources.

## How it reaches Cloudflare

The Pages project `eligiblecalls` is connected to the GitHub repository `vekicmilica02-design/eligiblecalls`. Every commit to `main` is built and deployed, including the data refresh commits made every 2 hours.

- Uploading this zip in the Cloudflare dashboard does not work: drag-and-drop uploads are not available for Git-connected projects and do not deploy the `functions/` folder.
- A Wrangler upload would work once, but the next data refresh builds `main` again and replaces it.

So the files go into the repository. The zip holds only the files this change adds or modifies, in their repository folders. It does not touch `site/data/`; the next refresh rebuilds that.

Follow the steps in this order. Until steps 1 to 3 are done, the rest of the site keeps working; only the Organization page shows an error.

## 1. Database tables (Cloudflare D1)

1. Cloudflare dashboard → **Storage & Databases → D1** → `calldar` → **Console**.
2. Paste the whole content of `migrations/0002_org.sql` and run it.
3. Check: the **Tables** tab lists `users`, `sessions`, `organizations`, `org_members`, `org_invites`, `profile_versions`, `extractions`, `login_tokens`, `rate_limits`, `ai_usage` next to the existing `usage` and `visitor_usage`.
4. Project ideas (phase 4): also run `migrations/0003_ideas.sql`, which adds the table `project_ideas`. Optional variable `ORG_IDEAS_PER_DAY` (default 5) limits idea generations per organisation per day.
5. Premium access, proposal PDF, Erasmus+ evaluation and automatic profile filling: run `migrations/0004_access.sql`. It adds columns to `users` (`name`, `idea_runs`), `extractions` (`result`) and `project_ideas` (`proposal`, `evaluations`) and the tables `access_requests` and `app_settings`. The D1 console runs one statement at a time best: paste each `ALTER TABLE` line on its own, then the rest. Take a bookmark first (`/bookmark` in the console's Time Travel tab) so the database can be restored. `ALTER TABLE ... ADD COLUMN` fails if the column already exists, so run each line once.

The migration only adds tables. Running it twice does nothing.

## 2. Google sign-in (Google Cloud)

1. Open https://console.cloud.google.com with the Google account that will own the sign-in, and create a project, for example "Eligible Calls".
2. **Google Auth Platform → Branding**: app name "Eligible Calls", a user support e-mail, developer contact e-mail. Save.
3. **Audience**: user type **External**. Then **Publish app** so the status is **In production**.
4. **Data access**: add the scopes `openid` and `.../auth/userinfo.email`. Both are basic scopes; Google requires no review for them. Without brand verification, Google shows the site address instead of the app name on its sign-in screen.
5. **Clients → Create client**: type **Web application**, name "eligiblecalls.pages.dev". Under **Authorized redirect URIs** add exactly:
   `https://eligiblecalls.pages.dev/api/auth/google/callback`
6. Copy the **Client ID** and the **Client secret**. Keep the secret in a password manager: Cloudflare cannot show it again after saving.

If you later add a domain (for example eligiblecalls.com), add its callback address in step 5 too and change `SITE_URL` in step 3.

## 3. Settings on the Pages project (Cloudflare)

Workers & Pages → `eligiblecalls` → **Settings → Variables and Secrets** → environment **Production**:

| Name | Type | Value |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Text | the Client ID from step 2 |
| `GOOGLE_CLIENT_SECRET` | Secret | the Client secret from step 2 |
| `SITE_URL` | Text | `https://eligiblecalls.pages.dev` |
| `ADMIN_EMAILS` | Text | the Google addresses that may download the user list and use the administration page (`#org/admin`), comma separated |
| `RESEND_API_KEY` | Secret | API key from resend.com, for the e-mail to administrators when someone asks for premium access |
| `EMAIL_FROM` | Text | sender, for example `Eligible Calls <onboarding@resend.dev>` (Resend's test sender delivers only to the address of the Resend account) or an address on a domain verified in Resend |

Optional: `ADMIN_NOTIFY_EMAILS` (where access requests are e-mailed, comma separated; default `ADMIN_EMAILS`), `ORG_AI_PER_USER` (AI actions per user per day, default 20), `ORG_BUDGET_SHARE` (share of each daily AI allowance the module may use, default 0.6), `MAX_ORGS_PER_USER` (default 10).

The existing bindings (`DB` = `calldar`, `AI`) and secrets (`TURNSTILE_SECRET`, `GROQ_API_KEY`, `HASH_SALT`) stay as they are. New settings apply from the next deployment, which step 4 starts.

Sign-in works on the production address only. Preview deployments (`<branch>.eligiblecalls.pages.dev`) send users back to `SITE_URL` after Google.

## 4. Put the files into the repository

GitHub → `vekicmilica02-design/eligiblecalls` → branch `main` → **Add file → Upload files**.

1. Unzip `eligiblecalls-org-intelligence.zip`.
2. Open the unzipped folder `eligiblecalls-org-intelligence` and drag **its contents** (the folders `functions`, `ingest`, `migrations`, `site`, `src`, `test` and the files next to them) into the GitHub upload area. GitHub keeps the folder paths and replaces files with the same path.
3. Commit message: "Organization Intelligence". Commit directly to `main`.

Cloudflare starts a build within a minute (Workers & Pages → `eligiblecalls` → **Deployments**). It should finish green.

With git instead of the web upload: copy the folder contents over a clone of `main`, `git add -A`, commit, push.

## 5. Rebuild the call data

GitHub → **Actions → Refresh calls → Run workflow**. This run rebuilds `site/data` with the Erasmus+ country eligibility (Serbia eligible for Erasmus+ calls instead of "not available") and commits it, which deploys again.

## 6. Check

1. https://eligiblecalls.pages.dev/api/health still shows `"chat":true`.
2. Open the site → **Organization** → tick the privacy box → **Sign in with Google**. You return signed in and can create an organisation.
3. Profile: fill in country and organisation type, save. **Eligibility matching** lists the open calls with a status and a percentage.
4. **Documents and sources**: upload a statute (PDF, DOCX or TXT); a review table of proposed fields appears.
5. Signed in with an address from `ADMIN_EMAILS`: https://eligiblecalls.pages.dev/api/admin/users.csv downloads the user list.

## Before inviting users

The sign-in box links to the "Accounts and privacy" section of the About page. That section describes what is stored and how to delete it. It does not yet name who runs Eligible Calls or how to contact them; add that (name and contact e-mail) before the site is shared widely.

## Turning on e-mail sign-in later

The one-time e-mail link sign-in is built in but off. It needs a domain verified in Resend. Then set `RESEND_API_KEY` (secret), `EMAIL_FROM` (for example `Eligible Calls <login@eligiblecalls.com>`) and `EMAIL_LOGIN` = `1`. Invitations are then also e-mailed; until then, invited people get access when they sign in with Google using the invited address.

## Files in this package

New: `functions/api/access/[[path]].js`, `functions/api/admin/[[path]].js`, `functions/api/auth/[[path]].js`, `functions/api/orgs/[[path]].js`, `functions/api/me.js`, `src/org/*`, `site/org/*`, `migrations/*`, `ingest/erasmus_guide.py`, `ingest/sources/erasmus_na.py`, tests under `test/`, this file.
Changed: `site/index.html` (navigation entry, Organization route, privacy section), `ingest/build.py` (Erasmus+ countries), `ingest/fetch_extra.py`, `ingest/watch_lists.py`, `schema.sql`, `package.json`, `README.md`, `test/mocks.js`, `test/server.js`.
