# U.S. Population Calculator

Single-page React + TypeScript + Vite app that estimates the size of U.S. population segments using ACS data. Filters cover sex, race, Census regions, and employment status. Counts are precomputed at build time and displayed instantly with a friendly, accessible UI.

## Getting started

```bash
npm install
npm run dev
```

## Data refresh (Census API)

The app ships with a placeholder dataset in `public/data/populationShares.json` so it runs offline. To fetch current ACS data:

1) Create `.env` in the project root:
```
CENSUS_API_KEY=your_key_here
# CENSUS_YEAR=2024
```
2) Run:
```bash
npm run fetch-data
```

This calls the ACS 1-year endpoints listed in the PRD, computes category shares, and rewrites `public/data/populationShares.json`. `CENSUS_API_KEY` improves reliability (avoids rate limits). Edit `CENSUS_YEAR` to target another year (default: `2024`).

## Build for production

```bash
npm run build
npm run preview
```

## Deployment

The site is fully static. Any static host (e.g., Vercel/Netlify) works as long as `public/data/populationShares.json` is present in the deployed assets.
