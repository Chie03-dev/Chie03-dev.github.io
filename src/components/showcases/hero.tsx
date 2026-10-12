"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { ChainsOverlay } from "@/components/ui/chains-overlay";

import { HeroBanner } from "@/components/showcases/hero-banner";
import { HeroTerminal } from "@/components/showcases/hero-terminal";

import { MagneticButton } from "@/components/ui/magnetic-button";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { useHeroLock } from "@/context/hero-lock-context";
import { getScrollEngine } from "@/lib/scroll-engine";
import { cn } from "@/lib/utils";

const STACK_TAGS = [
  "Kotlin",
  "Jetpack Compose",
  "Next.js 15",
  "TypeScript",
  "Electron",
  "Node.js",
];

/*
 * What I do, in three scannable pillars. Each is a real discipline I work in,
 * with a concrete, honest one-liner (no buzzword padding). Icons are inline
 * SVGs in the house line-icon style so there's no extra dependency.
 */
const HIGHLIGHTS = [
  {
    title: "Mobile",
    desc: "Offline-first Android apps in Kotlin & Compose that stay fast on real devices.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-5"
      >
        <rect width="14" height="20" x="5" y="2" rx="2" />
        <path d="M12 18h.01" />
      </svg>
    ),
  },
  {
    title: "Web",
    desc: "Full-stack sites and dashboards — typed end to end, tuned for Core Web Vitals.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-5"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    title: "Systems",
    desc: "APIs, data pipelines and background services that scale and stay observable.",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-5"
      >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14a9 3 0 0 0 18 0V5" />
        <path d="M3 12a9 3 0 0 0 18 0" />
      </svg>
    ),
  },
];

function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

/**
 * Engineering-focused hero section. The layout is a Server Component; the
 * interactive leaves (terminal, magnetic CTAs) are client components. The top of
 * the hero is a layered parallax band (see HeroBanner) that fades into the page
 * background; the status ping is the only CSS-driven motion, so no extra JS is
 * shipped for the scenery.
 */
export function Hero() {
  const { isLocked, isDropHot } = useHeroLock();
  const sectionRef = useRef<HTMLElement>(null);

  // Track the hero's 0..1 travel through the viewport to --hp, driving the
  // banner's slow parallax drift and the copy/portrait "exit" hand-off. Owned by
  // the shared scroll engine (single rAF + reduced-motion guard).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    return getScrollEngine().track(el, "--hp");
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden border-b border-border/40"
    >
      {/* Layered parallax scenery band across the top of the hero. Thirteen
          aligned SVG planes drifting at different depths, crossfading from
          sunset to a full-moon night when the cage breaks.

          Deliberately a normal flow block rather than an absolutely-positioned
          backdrop: the art's sun/moon (upper sky) and ground (lower edge) both
          need to stay unobstructed, and the copy is ~1076px tall — taller than
          most viewports. As a backdrop the copy covered the sky; as a flow
          block the copy starts below the band, so sky and ground are clear at
          any content height. See hero-banner.tsx. */}
      <HeroBanner />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 px-4 pt-8 pb-20 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:px-8 lg:pb-28">
        {/* Copy column */}
        <div className="hero-exit flex flex-col items-start gap-6">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 py-1 pr-4 pl-3 text-sm text-muted-foreground backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            Available for engineering opportunities
          </div>

          {/* Hero headline — role eyebrow, then a name-led statement that says
              what I actually build, then a one-line positioning summary. */}
          <div>
            <h1 className="text-balance text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="mb-3 block text-lg font-semibold tracking-[0.14em] text-primary uppercase sm:text-xl">
                Software Developer (Web &amp; Mobile)
              </span>
              <span className="block">
                I build software that{" "}
                <span className="text-primary">works offline</span> and scales
                online.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Android engineer by depth, full-stack by range. I ship
              offline-first mobile apps and the APIs behind them — obsessed with
              performance, clean architecture, and developer experience.
            </p>
          </div>

          {/* Call to action */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <MagneticButton className="w-full sm:w-auto">
              <Link
                href="#key"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Key to the Cage
                <ArrowDownIcon className="size-4" />
              </Link>
            </MagneticButton>
            <MagneticButton className="w-full sm:w-auto">
              <Link
                href="#contact"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background/60 px-6 py-3 text-sm font-medium backdrop-blur transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Get in Touch
                <ArrowUpRightIcon className="size-4" />
              </Link>
            </MagneticButton>
          </div>

          {/* What I do — three pillars as spotlight cards (icon + title + line) */}
          <ul className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title}>
                <SpotlightCard className="h-full rounded-lg border border-border/60 bg-muted/20">
                  <div className="flex h-full flex-col gap-2 p-4">
                    <span className="flex size-9 items-center justify-center rounded-md border border-border/60 bg-background/60 text-primary">
                      {item.icon}
                    </span>
                    <p className="text-sm font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </SpotlightCard>
              </li>
            ))}
          </ul>

          {/* Core stack tags */}
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Core stack
            </p>
            <ul className="flex flex-wrap gap-2">
              {STACK_TAGS.map((tag) => (
                <li
                  key={tag}
                  className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Cinematic portrait */}
        <div className="hero-exit relative order-2 flex flex-col items-center justify-center gap-4 lg:order-2 lg:items-center">
          <div
            id="hero-portrait"
            className="relative isolate w-full max-w-[240px] text-foreground/30 md:max-w-[320px]"
          >
            {/* Containment glow bound to the portrait: hugs it and is present
                only while the hero is chained, fading out when the cage breaks.
                Sized larger than the portrait so the caged jostle stays within
                it, and layered behind both the portrait and the chains. The
                gradient uses closest-side so the circle fits inside the element
                box and its top arc is never clipped. */}
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute -inset-10 -z-10 motion-reduce:animate-none transition-opacity duration-700",
                "bg-[radial-gradient(circle_closest-side_at_50%_50%,rgba(0,0,0,0.7)_0%,rgba(0,0,0,0.45)_40%,transparent_100%)]",
                isLocked
                  ? "animate-hero-vignette-pulse opacity-100"
                  : "opacity-0",
              )}
            />

            {/* Drop-zone outline. inset-0 so it traces the portrait's own box
                exactly — the same rect the drop hit-test uses, with no extra
                tolerance, so what you see is precisely what you must hit. */}
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 -z-10 border-2 border-primary transition-opacity duration-150",
                isDropHot && isLocked
                  ? "opacity-100 shadow-[0_0_28px_var(--primary)]"
                  : "opacity-0",
              )}
            />
            <div className="relative w-full" data-cage-drift>
              <Image
                src="/portrait.webp"
                alt="Portrait of Alchie O. Andilab"
                width={380}
                height={380}
                priority
                sizes="(max-width: 768px) 280px, 380px"
                className="h-auto w-full [mask-image:linear-gradient(to_bottom,black_75%,transparent_100%)] object-cover"
              />
              <ChainsOverlay isLocked={isLocked} />
            </div>
          </div>
        </div>

        {/* Interactive terminal */}
        <div className="relative order-3 mt-4 lg:col-span-2">
          <HeroTerminal />
        </div>
      </div>
    </section>
  );
}
