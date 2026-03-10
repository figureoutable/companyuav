# Company Scout

A Next.js web application that queries the **Companies House public API** to find recently incorporated UK companies and their directors, for sales outreach.

## Features

- **Search** by incorporation date range (last 7 / 14 / 30 / 60 days), SIC codes, company type, and registered address keyword
- **Results table** with company details and director names, occupations, nationalities
- **Export** selected rows or all results to CSV (`companies_house_YYYY-MM-DD.csv`)
- **Rate limiting**: configurable delay between officer lookups, exponential backoff on 429, live progress (“Fetching directors: X of Y companies”)
- **Dark mode** and responsive layout

## Tech Stack

- Next.js 14 (App Router)
- Kokonut UI / shadcn/ui, Tailwind CSS
- axios, Server Actions (API key stays server-side)

## Getting started

### 1. Register for a Companies House API key

The API is free to use. Get a key from:

- **Developer hub**: [developer.company-information.service.gov.uk](https://developer.company-information.service.gov.uk)

Sign in or register, then create an application and generate an API key. You’ll use this as Basic Auth (username = API key, password = empty).

### 2. Environment variables

Copy the example env file and add your key:

```bash
cp .env.example .env.local
```

Edit `.env.local` and set:

```env
COMPANIES_HOUSE_API_KEY=your-api-key-here
```

Optional (defaults shown):

```env
# Delay in ms between officer API calls (default 200). Helps stay under 600 req/5 min.
OFFICER_FETCH_DELAY_MS=200
```

**Never commit `.env.local`** — it’s in `.gitignore`.

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Email and enrichment

**Email addresses are not available** from the Companies House API. After exporting your CSV, use enrichment tools for contact data, for example:

- [Apollo.io](https://www.apollo.io/)
- [Hunter.io](https://hunter.io/)
- [LinkedIn Sales Navigator](https://business.linkedin.com/sales-solutions)

## API reference

- Base URL: `https://api.company-information.service.gov.uk`
- Advanced company search and company officers are used; all requests are made server-side so the API key is never exposed to the client.

## Project structure

- `app/page.tsx` — Search UI and results
- `app/actions.ts` — Server Actions for Companies House calls
- `components/` — SearchFilters, ResultsTable, ExportButton, ProgressBar
- `lib/companiesHouse.ts` — API client with rate limiting and backoff
- `lib/csvExport.ts` — CSV generation
- `types/index.ts` — TypeScript types for API and UI
