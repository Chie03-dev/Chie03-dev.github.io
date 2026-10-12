"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { ChainsOverlay } from "@/components/ui/chains-overlay";

import { HeroBanner } from "@/components/showcases/hero-banner";
import { HeroTerminal } from "@/components/showcases/hero-terminal";

import { MagneticButton } from "@/components/ui/magnetic-button";
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
 * Proof points derived straight from the hero subhead — no new claims, just
 * the same story in scannable form so the copy column isn't one gray wall.
 */
const HIGHLIGHTS = [
  {
    title: "Offline-first mobile",
    desc: "Resilient Android apps that work without a connection.",
  },
  {
    title: "APIs & pipelines",
    desc: "The services and data flows behind the screens.",
  },
  {
    title: "Performance & DX",
    desc: "Fast products, clean tooling, shipped to scale.",
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

          {/* Hero headline — fixed hierarchy instead of the split-role hack: a
              small eyebrow for the role, a big name-led statement, and the
              subhead carrying the detail. */}
          <h1 className="text-balance text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="mb-3 block text-sm font-semibold tracking-[0.2em] text-primary uppercase">
              Mobile &amp; Software Engineer
            </span>
            <span className="block text-foreground">
              Alchie builds apps
            </span>
            <span className="block text-foreground/60">
              that survive the real world.
            </span>
          </h1>

          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            I design and build resilient mobile and full-stack systems, from
            offline-first apps to the APIs and data pipelines behind them.
            Focused on performance, developer experience, and shipping products
            that scale.
          </p>

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

          {/* Highlights — the same subhead story, scannable */}
          <ul className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-3">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item.title}
                className="rounded-lg border border-border/60 bg-muted/30 p-3"
              >
                <p className="text-sm font-semibold text-foreground">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
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

        {/* Interactive terminal */}
        <div className="relative order-3 mt-4 lg:col-span-2">
          <HeroTerminal />
        </div>
      </div>
    </section>
  );
}
