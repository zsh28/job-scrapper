# Job Board Aggregator

Search multiple ATS job boards with human-friendly filters. The UI builds a Google query behind the scenes, then enriches results by parsing JSON-LD JobPosting data for dates, company, and location.

## Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` and add your Browserless websocket endpoint (for Playwright fallback on Vercel):

```env
PLAYWRIGHT_WS_ENDPOINT=wss://chrome.browserless.io?token=YOUR_TOKEN
```

## Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## API

GET `/api/jobs`

Query params:

- `domains`: comma-separated list of job board domains
- `q`: Google query string built from UI filters
- `after`: `YYYY-MM-DD` (optional Google operator)
- `max`: results per domain (default 20)
- `fetchDetails`: `true|false` (default false)
- `concurrency`: number of concurrent fetches (default 6)

Example:

```
/api/jobs?domains=ashbyhq.com,jobs.lever.co&q=(backend%20remote%20EMEA)%20-intitle:closed&after=2026-01-01&max=20
```

## Vercel notes

- Google HTML scraping is attempted first.
- If Google blocks, Playwright connects to Browserless via `PLAYWRIGHT_WS_ENDPOINT`.
- Serverless caches responses for ~2 minutes to reduce re-scraping.
