"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { ChainsOverlay } from "@/components/ui/chains-overlay";

import { HeroTerminal } from "@/components/showcases/hero-terminal";

import { MagneticButton } from "@/components/ui/magnetic-button";
import { useHeroLock } from "@/context/hero-lock-context";
import { getScrollEngine } from "@/lib/scroll-engine";
import { site } from "@/lib/site";
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
 * Split site.role into a muted lead line and an emphasized focal line at the
 * last " Systems" boundary, so the headline keeps its controlled two-line
 * layout while staying in sync with the single source of truth. Falls back to
 * one line if the role ever changes shape.
 */
const ROLE_SPLIT = site.role.lastIndexOf(" Systems");
const ROLE_LEAD = ROLE_SPLIT > 0 ? site.role.slice(0, ROLE_SPLIT) : site.role;
const ROLE_FOCUS = ROLE_SPLIT > 0 ? site.role.slice(ROLE_SPLIT + 1) : "";

/**
 * Engineering-focused hero section. The layout is a Server Component; the
 * interactive leaves (terminal, magnetic CTAs) are client components. The top of
 * the hero is a stretched woodland banner that fades into the page background;
 * the status ping is the only CSS-driven motion, so no extra JS is shipped for
 * the scenery.
 */
export function Hero() {
  const { isLocked } = useHeroLock();
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
      {/* Woodland banner: the illustration stretched edge-to-end into a short
          band across the top of the hero. object-fill squashes it into the wide,
          low box per the requested look. The inner media layer parallaxes with
          scroll for depth; it's scaled slightly above 1 so the drift never
          exposes a gap at the container edge. */}
      <div className="relative -z-20 h-[34vh] w-full overflow-hidden sm:h-[50vh]">
        <div className="hero-banner-media absolute inset-0">
          <Image
            src="/woodland.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-fill"
          />
        </div>
        {/* Bottom fade so the stretched band blends into the page background. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent"
        />
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pt-8 pb-20 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8 lg:pb-28">
        {/* Copy column */}
        <div className="hero-exit flex flex-col items-start gap-6 order-1 lg:order-1">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-sm text-muted-foreground backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            Available for engineering opportunities
          </div>

          {/* Hero headline — split from site.role into two controlled lines for
              predictable breaks and clear emphasis: a muted lead line and a
              bold, theme-colored focal line. */}
          <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block text-foreground/70">{ROLE_LEAD}</span>
            {ROLE_FOCUS ? (
              <span className="block text-primary">{ROLE_FOCUS}</span>
            ) : null}
          </h1>

          <p className="max-w-xl text-pretty text-lg text-muted-foreground">
            I design and build resilient mobile and full-stack systems, from
            offline-first apps to the APIs and data pipelines behind them.
            Focused on performance, developer experience, and shipping products
            that scale.
          </p>

          {/* Call to action */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <MagneticButton className="w-full sm:w-auto">
              <Link
                href="/#key"
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Key to the Cage
              </Link>
            </MagneticButton>
            <MagneticButton className="w-full sm:w-auto">
              <Link
                href="/#contact"
                className="inline-flex w-full items-center justify-center rounded-md border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Get in Touch
              </Link>
            </MagneticButton>
          </div>

          {/* Core stack tags */}
          <ul className="flex flex-wrap gap-2 pt-2">
            {STACK_TAGS.map((tag) => (
              <li
                key={tag}
                className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {tag}
              </li>
            ))}
          </ul>
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
