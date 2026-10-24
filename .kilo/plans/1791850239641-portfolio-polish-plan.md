# Portfolio polish — implementation plan

Saved plan: `D:\Developers\Projects\portfolio\.kilo\plans\1791850239641-portfolio-polish-plan.md`

## Goal

Execute the highest-leverage items from the full scan of the portfolio, in
priority order, without breaking the existing scroll-engine, containment, and
static-export pipeline. Everything here must keep `tsc --noEmit`, `eslint src`,
and `npm run build` green, and must still deploy via the Pages workflow.

## Constraints

- Static export (`output: "export"`): no Node server, no `next/image` optimization,
  no RSC-only prefetching of static assets. Keep `images.unoptimized: true`.
- The shared scroll engine (`src/lib/scroll-engine.ts`) is the single rAF loop;
  new scroll-linked work must go through `getScrollEngine().track()`, not a new
  listener.
- The hero containment state is site-wide (`HeroLockProvider` wraps the app);
  theme switching must keep flowing through `setDarkTheme` in `src/lib/theme.ts`.
- Reduced motion must be respected by every new animation (check
  `prefers-reduced-motion` and snap to the end state).
- Mobile must not gain horizontal page scroll (guard with `min-w-0` on grid
  items, as fixed in 4d13811).

## Decisions (resolved)

- **Framer Motion: no.** The scroll engine already covers scroll-linked
  transforms, reveals, and rail fills dependency-free. Adding framer-motion
  duplicates capability for ~30 KB. Page transitions will use the native View
  Transitions API instead.
- **Contact form: yes, via Formspree** (free tier, 50 submissions/month, works
  with static export). Endpoint goes in `src/lib/site.ts` as
  `contactFormEndpoint`; empty string disables the form and falls back to the
  mailto link.
- **OG image: generate programmatically** with sharp (already in node_modules)
  from the portrait + name + role, 1200×630, navy background matching the theme.
  No design tooling required.
- **GitHub activity section: delete the dead component.** Wiring it up needs a
  `GITHUB_TOKEN` secret in CI and the fallback data is fake; the portfolio
  already links to GitHub in the navbar and contact. Revisit later if wanted.
- **"Framer Motion" skill tag: remove** (not used anywhere in the live code).
- **"55 KB JS payload" stat: remove** (it is the Barangay project's payload,
  not the portfolio's).
- **Dead code: delete all of it** (list below). Nothing imports these.

## Phase 1 — Dead code cleanup (low risk, ~92 KB removed)

Delete these files (verify zero external references first — already confirmed):

- `src/components/showcases/case-study-drawer.tsx`
- `src/components/showcases/experience-section.tsx`
- `src/components/showcases/github-activity.tsx`
- `src/components/showcases/hero-lock-badge.tsx`
- `src/components/showcases/hero-terminal.tsx`
- `src/components/showcases/hero.tsx`
- `src/components/showcases/key-section.tsx`
- `src/components/showcases/life-card.tsx`
- `src/components/layout/contact-footer.tsx`
- `src/components/ui/code-block.tsx`
- `src/components/ui/metric-bar.tsx`
- `src/components/ui/monster-eyes.tsx.bak`
- `src/components/ui/spotlight-card.tsx`
- `src/components/ui/magnetic-button.tsx`
- `src/components/ui/halloween-flourish.tsx`
- `src/lib/experience.ts`
- `src/lib/projects.ts`
- `src/types/experience.ts`
- `src/types/project.ts`
- `src/content/.gitkeep`, `src/components/ui/.gitkeep`,
  `src/components/showcases/.gitkeep`

Edit:

- `src/data/portfolio.ts`: remove the `stats` array and the `Stat` interface;
  remove `"Framer Motion"` from the Web and Desktop skill group; fix the
  Barangay description's "55 KB JS payload" claim (drop the number, keep the
  Cloudflare Workers mention).
- `src/components/home/about.tsx`: already does not use stats; confirm no
  dangling import.

Validation: `tsc --noEmit`, `eslint src`, `npm run build` all green; the live
site renders identically (no imports changed).

## Phase 2 — SEO: OG image (high leverage)

- Add `scripts/generate-og.mjs` that uses `sharp` (already in node_modules) to
  render a 1200×630 PNG from the portrait + name + role on the navy background.
- Output to `public/og.png`; add `public/og.png` to the repo (generated asset,
  not gitignored) so the Pages build serves it.
- Wire into `src/app/layout.tsx` metadata: `openGraph.images` and
  `twitter.images` with width/height/alt.
- Add `apple-touch-icon` (180×180) generated the same way, or reuse the SVG
  icon scaled. Simpler: generate both in the same script.
- Optional: add the script to the `build` npm script so the image regenerates.

Validation: deploy, then check `https://chie03-dev.github.io/og.png` returns
200 and the Twitter Card Validator / LinkedIn Post Inspector render a preview.

## Phase 3 — Performance: code-split the guardian

- `src/components/home/key-band.tsx`: load `KeyVault` (and transitively
  `KeyGuardian`, 1241 lines) via `next/dynamic` with `{ ssr: false }`, since
  the guardian is client-only and only needed once the contact section scrolls
  into view.
- Keep a lightweight placeholder (a fixed-height box or the "Key to the Cage"
  heading) so layout does not shift.
- `src/components/ui/chains-overlay.tsx`: set `willReadFrequently: true` on the
  1×1 probe canvas context in `resolveToken`.

Validation: `npm run build` output shows the guardian in a separate chunk; LCP
and CLS unchanged; the drag-to-unlock flow still works end to end on the live
site.

## Phase 4 — Performance: image trims

- Downscale `public/projects/mobilepos.webp` to ~500 px wide (keep aspect
  ratio) with sharp; re-check the card renders crisply at 2× DPR.
- Add `loading="lazy"` to the `<img>` in `notched-project-card.tsx` (covers are
  below the fold; the portrait keeps `priority`).
- Confirm `Quiz.webp` (360×360) is only used at card size — already small.

Validation: image dimensions in the built HTML; no visual regression in the
projects rail.

## Phase 5 — UX: contact form

- Add a `ContactForm` client component in `src/components/home/contact-form.tsx`
  posting JSON to `site.contactFormEndpoint` (Formspree). Fields: name, email,
  message. Include honeypot + submit button with pending state and a success
  toast (plain text, no library).
- When `contactFormEndpoint` is empty, render the existing mailto link instead
  (no form, no broken submit).
- Place the form above the link grid in `contact.tsx`, inside the SectionRail
  so it inherits the rail.
- Add `contactFormEndpoint: ""` to `src/lib/site.ts` with a comment.

Validation: with an empty endpoint, build + live site unchanged; with a real
endpoint, a submission lands in the inbox. Test with a temporary Formspree
endpoint before committing the config value.

## Phase 6 — UX: back to top + View Transitions

- Add a `BackToTop` client component: fixed bottom-right, appears after the
  user scrolls past ~1 viewport height, smooth-scrolls to top via the existing
  Lenis `anchors` path (or `window.scrollTo` with `behavior: smooth`). Respect
  reduced motion.
- Mount it in `layout.tsx` inside the `z-10` layer.
- Add `@view-transition { navigation: auto; }` to `globals.css` and wrap the
  page-level fade in a `view-transition-name` so in-page section jumps glide
  instead of snapping. Keep it behind `prefers-reduced-motion`.

Validation: works with Lenis enabled and disabled; no CLS regression; reduced
motion disables the transition.

## Phase 7 — Accessibility polish on the projects rail

- Add `role="region"`, `aria-roledescription="carousel"`, and
  `aria-label` to the rail `<ul>` (already has `aria-label`; add the rest).
- Add `aria-label` to each card link describing "Open <title>".
- Ensure the rail is keyboard-scrollable: it already has `tabIndex={0}` and
  `snap-x`; verify ArrowLeft/ArrowRight scroll by one card.

Validation: keyboard-only walkthrough of the rail; screen-reader announcement
check (manual).

## Phase 8 — Cleanup of unused types + final verification

- Remove now-orphaned exports: `Stat` interface (in `portfolio.ts`), and any
  type-only imports left dangling.
- Run the full verification matrix:
  - `tsc --noEmit`
  - `eslint src`
  - `npm run build`
  - local static-server smoke test of `out/`
  - Playwright: unlock flow, reduced motion, mobile (390 px), no horizontal
    overflow, no console errors, LCP < 1 s.
- Deploy and verify the live site.

## Out of scope (needs user input or assets)

- Real project screenshots (the `schoolsystems.svg` mockup and the three
  `.webp` covers). Swap in `public/projects/<name>.webp` and update the
  `image` field in `portfolio.ts`.
- A real GitHub activity section. The dead component exists but its fallback
  data is fake; wiring it up needs a `GITHUB_TOKEN` secret in CI. Decide
  whether to revive or delete (Phase 1 deletes it by default).
- A blog/writing section for SEO authority. New content, not a code change.
- Contact form endpoint value (Formspree form ID). Left as `""` until the user
  creates the form.

## Open questions

1. Contact form: Formspree (recommended, free, no backend) or a different
   provider? If neither, keep the mailto link and skip Phase 5.
2. OG image: generated from the portrait (recommended, consistent with the
   hero) or a custom design? If custom, drop `public/og.png` in place and skip
   the generator.
3. Should the `initials` badge and availability dot stay in the navbar (kept by
   default) or come out too?

## Validation plan (summary)

Each phase ends with: `tsc --noEmit` → `eslint src` → `npm run build` →
static-server smoke test → Playwright checks (unlock flow, reduced motion,
mobile overflow, console errors). Final phase re-runs the full matrix and
deploys.
