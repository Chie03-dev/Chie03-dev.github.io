# Portfolio

A production-grade personal portfolio and engineering case-study site, built as
a fully static export and deployed to GitHub Pages.

## Overview

This is the personal site of **Alchie O. Andilab**, a Mobile and Full-Stack
Systems Engineer. It showcases featured project case studies, a work-experience
timeline, a technical skills matrix, and live GitHub activity, all rendered as
static HTML for fast, secure, zero-runtime-server hosting.

## Tech Stack

- **Framework:** Next.js 15 (App Router, React Server Components by default)
- **Library:** React 19
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS v4 (CSS variables, oklch tokens, dark mode)
- **Content:** Typed in-memory content engine in `src/lib/`
- **Deployment:** Static export to GitHub Pages via GitHub Actions

## Local Development

Requires Node.js 20 or newer.

```bash
npm install        # Install dependencies
npm run dev        # Start the dev server at http://localhost:3000
npm run build      # Production build to the out/ directory (static export)
npm run typecheck  # Run TypeScript type checking (no emit)
npm run lint       # Run ESLint
```

After `npm run build`, the static site is written to `out/` and can be served
with any static file server.

## Customizing Content

Most personal data lives in a few small, typed files. Edit the values, keep the
existing shapes, and the UI updates automatically.

### Site identity and links: `src/lib/site.ts`

Controls the name, role, description, email, and social links used across
metadata, the footer, the contact section, and the command palette.

```ts
export const site = {
  name: "Alchie O. Andilab",
  role: "Mobile & Full-Stack Systems Engineer",
  description: "Computer Science graduate specializing in native Android ...",
  url: "https://chie03-dev.github.io",
  email: "alchieandilab2003@gmail.com",
  location: "Glendale, AZ",
  github: "https://github.com/Chie03-dev",
  githubUsername: "Chie03-dev",
  linkedin: "https://linkedin.com/in/alchieandilab",
  resumeUrl: "/Resume.pdf",
};
```

Set `url` to your real domain so metadata, Open Graph, robots, and the sitemap
resolve correctly. Place your resume PDF in the `public/` folder and point
`resumeUrl` at it.

### Case studies: `src/lib/projects.ts`

Each entry in the `PROJECTS` array is a deep-dive post-mortem rendered as a
project card. Set `featured: true` to show a project on the landing page. Update
`title`, `description`, `role`, `timeline`, `tags`, `metrics`,
`architectureHighlights`, and the optional `githubUrl` / `liveUrl` links. The
`ProjectCaseStudy` type in `src/types/project.ts` documents every field.

### Work history and skills: `src/lib/experience.ts`

`EXPERIENCE` holds your career timeline (role, company, location, period,
description, highlights, and skills). `SKILL_CATEGORIES` groups your skills by
domain; set `highlight: true` on a skill to emphasize it as part of your primary
stack. See `src/types/experience.ts` for the exact shapes.

### GitHub activity: environment variables

The open-source feed reads public repository stats from the GitHub API. Set the
following (for example in a local `.env.local` file, or as GitHub Actions
repository Secrets):

```
GITHUB_USERNAME=your-github-username
GITHUB_TOKEN=optional-personal-access-token
```

If these are unset, or the network is unavailable or rate-limited, the section
automatically falls back to representative sample data so the build never fails.

## Deployment

The site is a static export and deploys to GitHub Pages automatically.

- Pushing to the `main` branch triggers the workflow in
  `.github/workflows/deploy.yml`.
- The workflow installs dependencies, runs `npm run build`, and uploads the
  generated `out/` directory to GitHub Pages using the official Pages actions.
- The configuration in `next.config.ts` enables `output: "export"` and
  unoptimized images for fully static hosting.

To go live, enable GitHub Pages in your repository settings and select
**GitHub Actions** as the source. If you deploy to a project page under a
subpath (for example `username.github.io/repo`), set a matching `basePath` and
`assetPrefix` in `next.config.ts`.
