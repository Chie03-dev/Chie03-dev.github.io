import Link from "next/link";

import { SectionRail } from "@/components/ui/section-rail";

/**
 * Branded 404. Next.js renders this for unmatched routes. Kept as a Server
 * Component — nothing interactive here, just a message and a way back.
 */
export default function NotFound() {
  return (
    <section id="not-found">
      <SectionRail rail={false} inset={false}>
        <h1 className="mb-6 text-4xl font-bold tracking-tight">404</h1>
        <p className="mb-8 text-lg text-muted-foreground">
          The page you&rsquo;re looking for doesn&rsquo;t exist.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-border/40 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Back to portfolio
          </Link>
          <Link
            href="/#contact"
            className="inline-flex items-center rounded-md border border-border/40 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Or get in touch
          </Link>
        </div>
      </SectionRail>
    </section>
  );
}
