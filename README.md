# Portfolio

Personal portfolio and engineering case studies, built as a fully static site.

**Live:** https://chie03-dev.github.io

## Built With

Next.js 15, React 19, TypeScript, and Tailwind CSS v4.

## Scripts

- `npm run dev` - local dev server
- `npm run build` - production static export to `out/`
- `npm run typecheck` - TypeScript
- `npm run lint` - ESLint
- `npm run smoke` - Playwright smoke tests (overflow, console errors, reduced motion, OG image)
- `npm run generate:og` - regenerate OG/apple-touch icons
- `npm run lhci` - Lighthouse CI

## CI/CD

GitHub Actions builds and deploys to GitHub Pages on push to `main`. The workflow runs `npm ci`, `npm run build`, then publishes `out/`. Run `npm run typecheck && npm run lint && npm run build && npm run smoke` locally before pushing.