# Portfolio next steps plan

## Goal
Address the remaining out-of-scope items from the polish plan, in priority order.

## Steps
1. Real project screenshots: replace `public/projects/*.webp` and update `image` fields in `src/data/portfolio.ts`.
2. Contact form endpoint: create Formspree form, set `contactFormEndpoint` in `src/lib/site.ts`, test submission.
3. Playwright coverage: add unlock-flow, reduced-motion, and mobile-overflow specs; run in CI.
4. Lighthouse CI: add `lighthouserc.js` and a GitHub Actions step after build.
5. Blog/writing section: add Markdown/MDX content pipeline, `/blog` route, navbar link, sitemap entries.
6. GitHub activity (optional): revive with a `GITHUB_TOKEN` secret or delete fully.

## Validation
`tsc --noEmit` → `eslint src` → `npm run build` → `npm run smoke` → deploy.