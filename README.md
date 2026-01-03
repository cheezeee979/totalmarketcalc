# U.S. Population Calculator

Single-page React + TypeScript + Vite app that estimates the size of U.S. population segments using ACS data. Filters cover sex, race, Census regions, and employment status. Counts are precomputed at build time and displayed instantly with a friendly, accessible UI.

## Getting started

```bash
npm install
npm run dev
```

## Data refresh (Census API)

The app ships with placeholder datasets so it runs offline. To fetch current ACS data:

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

## Modeled traits (BRFSS + ATUS)

Offline scripts turn BRFSS/ATUS microdata into small JSON artifacts that power the “Modeled (Inferred)” filters. Place raw files under:

- `data/raw/brfss/2024/` (XPT)
- `data/raw/atus/` (CSV extracts for respondent + activity summary)

Then run:
```bash
npm run build:modeled-data
```
This will:
- Build the ACS cell backbone (`data/derived/acs_cells.json`)
- Fit weighted logistic regressions on BRFSS/ATUS and emit trait probabilities (`data/derived/traits/*.json`)
- Validate coverage and write `data/derived/traits_manifest.json`

Outputs are copied into `public/data/derived/` for runtime use. Python deps live in `scripts/modeling/requirements.txt`.

## Build for production

```bash
npm run build
npm run preview
```

## Deployment

The site is fully static. Any static host (e.g., Vercel/Netlify) works as long as `public/data/populationShares.json` is present in the deployed assets.
