import Image from "next/image";
import Link from "next/link";

const STACK_TAGS = [
  "Kotlin",
  "Jetpack Compose",
  "Next.js 15",
  "TypeScript",
  "Electron",
  "Node.js",
];

/**
 * Engineering-focused hero section. Fully static (Server Component). The
 * ambient gradient and the live status ping are CSS-driven, so no client JS is
 * shipped for the visuals.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border/40">
      {/* Ambient gradient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_70%)] dark:bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--primary)_30%,transparent),transparent_70%)]"
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
            Available for senior engineering roles
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Mobile &amp; Full-Stack
            <br className="hidden sm:block" /> Systems Engineer
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground">
            I design and build resilient mobile and full-stack systems, from
            offline-first apps to the APIs and data pipelines behind them.
            Focused on performance, developer experience, and shipping products
            that scale.
          </p>

          {/* Call to action */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/#projects"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Explore Case Studies
            </Link>
            <Link
              href="/#contact"
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-5 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Get in Touch
            </Link>
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

        {/* Terminal / architecture preview card */}
        <div className="relative order-3 lg:col-span-2">
          <div className="rounded-lg border border-border bg-card shadow-lg shadow-primary/5">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ml-2 text-xs text-muted-foreground">
                architecture.ts
              </span>
            </div>
            {/* Code body */}
            <pre className="overflow-x-auto px-4 py-4 text-sm leading-relaxed">
              <code className="font-mono">
                <span className="text-muted-foreground">{"// core stack"}</span>
                {"\n"}
                <span className="text-primary">const</span>{" "}
                <span className="text-foreground">engineer</span>{" = {\n"}
                {"  "}
                <span className="text-foreground">mobile</span>:{" "}
                <span className="text-green-600 dark:text-green-400">
                  &quot;Kotlin + Compose&quot;
                </span>
                {",\n  "}
                <span className="text-foreground">web</span>:{" "}
                <span className="text-green-600 dark:text-green-400">
                  &quot;Next.js 15&quot;
                </span>
                {",\n  "}
                <span className="text-foreground">desktop</span>:{" "}
                <span className="text-green-600 dark:text-green-400">
                  &quot;Electron&quot;
                </span>
                {",\n  "}
                <span className="text-foreground">data</span>:{" "}
                <span className="text-green-600 dark:text-green-400">
                  &quot;PostgreSQL&quot;
                </span>
                {",\n"}
                {"};"}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
