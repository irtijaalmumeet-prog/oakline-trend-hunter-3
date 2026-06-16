# Oakline Trend Hunter

Single Next.js app for **live, free-data** product research.

- **Google Trends** (no key) → real trending searches + rising niche queries, per country.
- **Claude** (your key) → turns the live trends into scored product ideas.
- **YouTube** (optional free key) → extra demand signal.
- **One-click research links** open Facebook Ads Library, TikTok, AliExpress, CJ, Amazon in the user's browser, pre-searched. No scraping.
- **Owner + client** logins; results on a dashboard.

## Run
```
npm install
copy .env.example .env.local   # fill in CLAUDE_API_KEY, OWNER_EMAIL, OWNER_PASSWORD, JWT_SECRET
npm run dev                    # http://localhost:3000
```

## Why results are real and differ
Each hunt fetches live Google Trends for the chosen niche + country (changes over time),
and Claude proposes products grounded in those live terms — so different niches/countries
give different results. Facebook/TikTok ad libraries are not scraped; they open in the
browser for manual review (the compliant approach).

Tests: `node test/app.test.js`.
