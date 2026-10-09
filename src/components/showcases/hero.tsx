import Image from "next/image";
import Link from "next/link";

import { HeroTerminal } from "@/components/showcases/hero-terminal";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { TextScramble } from "@/components/ui/text-scramble";
import { site } from "@/lib/site";

const STACK_TAGS = [
  "Kotlin",
  "Jetpack Compose",
  "Next.js 15",
  "TypeScript",
  "Electron",
  "Node.js",
];

/**
 * Engineering-focused hero section. The layout is a Server Component; the
 * interactive leaves (terminal, text scramble, magnetic CTAs) are client
 * components. The ambient gradient, background grid, light beam, and status
 * ping are all CSS-driven, so no extra JS is shipped for the scenery.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border/40">
      {/* Ambient gradient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_70%)] dark:bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--primary)_30%,transparent),transparent_70%)]"
      />

      {/* Subtle background grid, masked to fade out toward the fold */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
      />

      {/* Passing light beam sweeping down over the grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 animate-hero-light-beam bg-[linear-gradient(to_bottom,transparent,color-mix(in_oklab,var(--primary)_40%,transparent),transparent)] opacity-60 motion-reduce:animate-none"
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8 lg:py-28">
        {/* Copy column */}
        <div className="flex flex-col items-start gap-6 order-2 lg:order-1">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-sm text-muted-foreground backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            Available for engineering opportunities
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <TextScramble text={site.role} />
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground">
            I design and build resilient mobile and full-stack systems, from
            offline-first apps to the APIs and data pipelines behind them.
            Focused on performance, developer experience, and shipping products
            that scale.
          </p>

          {/* Call to action */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <MagneticButton className="w-full sm:w-auto">
              <Link
                href="/#projects"
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Explore Case Studies
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
        <div className="relative order-1 flex justify-center lg:order-2 lg:justify-end">
          {/* Ambient glow behind the portrait */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_25%,transparent)_0%,transparent_70%)]"
          />
          <div className="animate-hero-portrait motion-reduce:animate-none relative w-full max-w-[280px] md:max-w-[380px]">
            <Image
              src="/portrait.webp"
              alt="Portrait of Alchie O. Andilab"
              width={380}
              height={380}
              priority
              sizes="(max-width: 768px) 280px, 380px"
              className="h-auto w-full [mask-image:linear-gradient(to_bottom,black_75%,transparent_100%)] object-cover"
            />
          </div>
        </div>

        {/* Interactive terminal */}
        <div className="relative order-3 lg:col-span-2">
          <HeroTerminal />
        </div>
      </div>
    </section>
  );
}
