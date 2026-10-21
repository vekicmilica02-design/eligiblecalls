# Eligible Calls

A public search site for open European funding calls from several official sources, with eligibility per country and a project-match assistant. Runs on free tiers: GitHub Actions fetches the data, Cloudflare Pages serves the site, and a Cloudflare Pages Function answers assistant questions with Workers AI (Groq as a fallback).

## How it works

```
every 2 hours                     GitHub Actions (your repository)
                                  ingest/fetch.py   EU Funding & Tenders Portal search API + topic details
                                  ingest/fetch_extra.py   other sources (see Sources), call pages checked
                                                    (calls open for submission, plus calls announced as forthcoming)
                                  ingest/build.py   eligibility, deadlines (17:00 Brussels), change log
                                  commits site/data/*.json if anything changed
                                          |
                                          v  (each data commit triggers a Cloudflare Pages build)
visitor ── eligiblecalls.pages.dev ──> Cloudflare Pages
                                  site/index.html + site/data/*.json   static, no request limit
                                  /api/chat   Pages Function: picks matching calls from site/data/index.json,
                                              asks Workers AI (or Groq), streams the answer back
                                  /api/health  is the assistant available today?
                                  D1 database  daily usage counters only (no messages, no IPs)
```

- The browser does search, filters, eligibility and countdowns itself. Calls close at 17:00 Brussels time on their deadline date, even if the page stays open.
- An open page checks for a new import every 15 minutes and loads it without a reload.
- The assistant never sees the whole catalogue. The function ranks the open calls against the question (and the attached document), drops calls the applicant's country is not eligible for, and sends the 8 best matches with their deadlines, funding and eligibility to the model. The model is told to recommend only those calls.

## Sources

| Source | What | How it is read | Call link | Eligibility |
|---|---|---|---|---|
| EU Funding & Tenders Portal, grant topics | EU programme calls (Horizon Europe, Digital Europe, Creative Europe, CERV, ...) | search API + topic details JSON | Portal topic page | official lists of participating countries + call rules |
| EU Funding & Tenders Portal, calls by EU-funded projects | financial support to third parties (cascade funding) | search API, type 8 | organiser page quoted in the Portal record; published only if it shows the call (title in the page, or most title words in the page and its title/heading; no forms, video meetings, login, events or news pages) | "check the call" |
| interreg.eu (Interact / keep.eu) | Interreg cross-border, transnational and interregional calls | public search index behind interreg.eu/calls-for-projects | programme's own call page | programme-area countries: eligible with a condition (regions); others: not eligible |
| eeagrants.org (Financial Mechanism Office) | EEA and Norway Grants calls | open-calls listing (HTML) | call page on eeagrants.org | beneficiary country: eligible; IS/LI/NO: check (partners); others: not eligible |
| ERA-LEARN | European partnerships' joint transnational calls | call calendar + call pages (HTML) | partnership's call page (or the ERA-LEARN page) | countries with a participating funder: eligible with a condition |
| ukri.org | UKRI funding opportunities | Funding Finder listing (HTML) + "Who can apply" on each page | ukri.org opportunity page | UK: eligible; others: not eligible where the page states UK eligibility |
| eit.europa.eu | EIT and KIC opportunities | opportunities listing (HTML) | opportunity page on eit.europa.eu | "check the call" |
| business.esa.int | ESA Business Applications funding | funding listing + pages (HTML) | funding page | countries listed on the page |

Deadline strings (ingest/deadlines.py, the site and the assistant read the same forms): `2026-11-30` = Portal grant topic, 17:00 Brussels; `2026-11-30T16:00|Europe/London` = time and zone stated by the source; `2026-11-30|~` = only a date is stated (kept open until 23:59 Brussels, labelled "time not stated").

Each source runs on its own. If one fails, its last good records are kept for up to 3 days and the About page and audit say so. Link checks are cached in `ingest/extra_state.json` (24 h for a pass, 6 h for a failure). Calls found in two sources are shown once (Portal first, then EIT, Interreg, EEA, ERA-LEARN, ESA, UKRI, project calls).

To add a source: write `ingest/sources/<name>.py` with `KEY`, `NAME` and `run(cache, fp_names)` returning records built with `common.record(...)` (see the existing modules), add the name to `SOURCES` in `ingest/fetch_extra.py`, and if it states eligible countries, map them in `extra_eligibility()` in `build.py`.

Considered and not imported (21 October 2026): COST (robots.txt blocks automated agents; one open call a year), EUREKA/Eurostars (bot challenge), Erasmus+ decentralised actions (no public data; fixed yearly deadlines), Western Balkans Fund (robots.txt disallows all), Council of Europe funds (403 to scripts), EURAXESS funding (blocks scripts; many reposts by a commercial aggregator), On the Move (no reuse terms: ask first), commercial aggregators such as fundsforNGOs (terms and copyright).

## What it costs

Nothing, within these free limits (checked 1 October 2026):

| Service | Free limit | Eligible Calls use |
|---|---|---|
| GitHub Actions | free in a public repository; 2,000 minutes a month in a private one | about 1,100 minutes (12 runs a day, about 3 minutes each) |
| Cloudflare Pages | 500 builds a month per account; static files unlimited | at most 12 builds a day (only when data changed), about 360 a month |
| Pages Functions (Workers free) | 100,000 requests a day, 10 ms CPU per request | 2 requests per assistant message |
| D1 | 5 GB, 5 million rows read and 100,000 written a day | a few rows per message |
| Workers AI | 10,000 neurons a day | about 180 neurons per message, so about 50 messages a day |
| Groq (fallback) | for openai/gpt-oss-120b: 30 requests a minute, 1,000 a day, 8,000 tokens a minute, 200,000 tokens a day | about 6,000 tokens per message, so about 30 messages a day, one a minute |

CPU time: the free plan allows 10 ms of CPU per request. Measured locally, an assistant request uses about 1 ms when the Worker is already running and about 9 ms on a cold start, which is close to the limit. If the Pages project's Functions logs show "Exceeded CPU time limit" for `/api/chat`, Workers Paid raises the limit.

So the assistant handles roughly 50 to 80 messages a day for free. When both allowances are used, it says it is resting until 00:00 UTC (02:00 Brussels in summer, 01:00 in winter). Search and filters keep working. Each visitor can send 10 messages a day (`DAILY_VISITOR_LIMIT`).

When you outgrow it: Workers Paid is $5 a month and Workers AI then costs $0.011 per 1,000 neurons beyond the free 10,000 a day, about $0.002 per assistant message. 1,000 messages a day would be about $55 a month on top of the $5. Nothing else changes until the site has far more visitors.

Not used, and why: Gemini's free tier may not be used for apps offered to users in the EEA, Switzerland or the UK (Gemini API terms). Supabase free pauses after a week without activity. Netlify's free plan counts credits per deploy and would run out with deploys every 4 hours.

## Setup

You need a free GitHub account and a free Cloudflare account. About 30 minutes.

### 1. GitHub

1. Create a new **private** repository (private repositories get 2,000 free Actions minutes; scheduled workflows in public repositories stop after 60 days without activity).
2. Upload the contents of this folder to it (GitHub web: "uploading an existing file", or `git push`). Make sure the hidden `.github` folder is included: it holds the schedule. On a Mac, press Cmd+Shift+. in Finder to show hidden folders before dragging.
3. Repository **Settings → Actions → General → Workflow permissions**: choose **Read and write permissions** and save. The workflow needs this to commit new data.
4. **Actions** tab → **Refresh calls** → **Run workflow**. After 2 to 5 minutes it should finish green and commit `Data refresh …`. This first run also confirms that GitHub's servers can reach the EU Portal API. If it fails, open the run log; the error is printed there and GitHub emails you about failed runs.

### 2. Cloudflare Pages

The live project is **eligiblecalls** (eligiblecalls.pages.dev), connected to this repository through the Cloudflare Pages GitHub app. Every commit to `main`, including the data commits of the refresh workflow, starts a Pages build and deploys the site and the assistant (`functions/`).

To set it up again: **Workers & Pages → Create → Pages → Import an existing Git repository**, pick the repository (if it is not listed, add it to the "Cloudflare Workers and Pages" app under GitHub → Settings → Applications → Configure), Framework preset **None**, Build command empty, Build output directory **`site`**.

Refresh frequency: the workflow runs every 2 hours and commits only when the data changed, so at most 12 Pages builds a day (the free plan allows 500 builds a month per account). Actions minutes: about 1,100 a month; free without limit while the repository is public. GitHub disables the schedule of a public repository after 60 days without repository activity; the data commits of the workflow keep it active as long as calls change. In a private repository the 2,000 free minutes a month cover the 2-hour schedule.

The workflow also has an optional Wrangler deploy step for a Direct Upload project (one created by dragging files into the dashboard). It is skipped unless the repository variable `CF_PAGES_PROJECT` and the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set. It is not needed with the Git connection above.

The previous project **calldar** (calldar.pages.dev, repository vekicmilica02-design/calldar) is no longer refreshed: its workflow was disabled on 21 October 2026.

### 3. Assistant

1. **D1**: the live project uses the existing database `calldar` (bound as `DB`). For a new one: dashboard → **Storage & Databases → D1 → Create**, open it → **Console**, paste the contents of `schema.sql`, run it.
2. Pages project → **Settings → Bindings** (older dashboards: Settings → Functions):
   - add **D1 database**: variable name `DB`, database `calldar`
   - add **Workers AI**: variable name `AI`
3. Pages project → **Settings → Variables and Secrets**, add:
   - `HASH_SALT`: any long random text, as a **secret** (used to count visitors without storing IPs)
   - optional: `DAILY_VISITOR_LIMIT` (default 10), `DAILY_NEURON_BUDGET` (default 9000), `AI_MODEL` (default `@cf/meta/llama-4-scout-17b-16e-instruct`)
4. **Deployments → … → Retry deployment**. Bindings and variables apply from the next deployment.
5. Open `https://<project>.pages.dev/api/health`. It should show `"chat":true`.

### 4. Groq fallback (optional, recommended)

1. Create a free account at console.groq.com → **API Keys → Create**.
2. Add it to the Pages project as a **secret** named `GROQ_API_KEY`, then redeploy.
Optional: `GROQ_MODEL` (default `openai/gpt-oss-120b`), `GROQ_DAILY_TOKENS` (default 190000).

### 5. Your own domain (eligiblecalls.com)

1. Register eligiblecalls.com at any registrar (Cloudflare Registrar sells at cost).
2. Pages project → **Custom domains → Set up a domain**, enter `eligiblecalls.com`, and follow the DNS steps shown. If the domain is registered at Cloudflare, the records are added for you.
3. Add `eligiblecalls.com` to the Turnstile widget's hostnames if you use Turnstile.

### 6. Bot protection (recommended once you share the link)

1. Cloudflare dashboard → **Turnstile → Add widget**, hostname `<project>.pages.dev` (and your own domain if you add one), mode **Managed**.
2. Put the **site key** in `site/config.js` (`turnstileSiteKey`) and commit.
3. Add the **secret key** to the Pages project as a secret named `TURNSTILE_SECRET`, then redeploy.

Without Turnstile, a script could use up the day's free allowance; the per-visitor limit slows that down but does not stop it.

## Keeping the data right

- **New participation restrictions.** When a call's official text limits participation (for example "participation is limited to legal entities established in Member States"), and the call is not yet in `CALL_RULES` in `ingest/build.py` or in `ingest/reviewed.json`, the build sets every non-EU country to "Check the call document" for that call and lists it in `ingest/review.md`. The workflow opens a GitHub issue titled "Calls with an unreviewed participation restriction". Read the call, then either add a rule to `CALL_RULES` (quote the official text) or add the id to `reviewed.json` if the programme list already gives the right answer.
- **New lists of participating countries.** Every Monday the workflow downloads the Commission's lists and compares their version line with the one in `build.py`. A new version opens an issue. Eligibility does not change automatically; update `PROGRAMMES` in `build.py` by hand.
- **Portal changes.** The search API is public but undocumented. If it changes, the workflow fails (GitHub emails you), the site keeps the last good data, and after 12 hours a warning about the data's age appears at the top of the page. The build refuses to publish if fewer than 20 open calls come back.
- **Not published:** EU external action calls (the PROSPECT page needs an EU Login, so the call page cannot be checked), and calls run by EU-funded projects whose organiser page could not be confirmed to show the call. See the About page.

## Files

```
.github/workflows/refresh.yml   schedule: every 2 hours, plus a weekly list check
ingest/fetch.py                 Portal search + topic details; only re-fetches topics whose checksum changed
ingest/fetch_extra.py           runs the other sources; writes ingest/extra.json (records) and ingest/extra_state.json (link-check cache)
ingest/sources/                 one module per source (cascade, interreg, eeagrants, eralearn, ukri, eit, esa) + common.py
ingest/deadlines.py             deadline string forms shared with the site and the assistant
ingest/build.py                 eligibility engine, deadlines, change log, chat index, audit
ingest/watch_lists.py           weekly check of the participating-country lists
ingest/reviewed.json            calls whose restriction text you have reviewed
ingest/state.json               checksums and topic details from the last run (written by the workflow)
site/index.html                 the whole website
site/config.js                  public settings (Turnstile site key)
site/_headers                   security and cache headers for Cloudflare Pages
site/data/                      calls.json, index.json, changes.json, programmes.json, taxonomy.json, audit.md
functions/api/chat.js, health.js  Pages Functions (thin wrappers)
src/                            assistant code: retrieval and prompt (core.js), providers, usage counters
schema.sql                      D1 tables
test/                           API tests, a local preview server, a sample import
```

## Local development

Python 3.11+ and Node 22+.

```
pip install -r ingest/requirements.txt
python ingest/fetch.py && python ingest/fetch_extra.py && python ingest/build.py   # live data
python ingest/fetch_extra.py ukri interreg              # re-run only some sources
RAW=test/fixtures/raw_2026-09-30.json python ingest/build.py   # sample data, no network

npm test                     # assistant API tests (no network, uses test doubles)
node test/server.js          # preview on http://localhost:8788 with a test model in place of Workers AI
```

The local preview answers with a canned test model so you can check the interface. Real answers need the Cloudflare deployment.
