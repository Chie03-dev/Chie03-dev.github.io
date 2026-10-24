"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { getScrollEngine } from "@/lib/scroll-engine";
import { cn } from "@/lib/utils";

/**
 * A single rail that spans the whole right-hand content column, so the
 * timeline reads as one continuous spine instead of one rail per section.
 */
export function PageRail({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return getScrollEngine().track(el, "--pr");
  }, []);

  return (
    <div ref={ref} className={cn("relative min-w-0 space-y-16", className)}>
      <span
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-[19px] w-[2px] overflow-hidden bg-gradient-to-b from-transparent via-muted-foreground/25 to-transparent [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)]"
      />
      <span
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-[19px] w-[2px] origin-top rounded-full bg-gradient-to-t from-primary/10 via-primary to-primary"
        style={{ transform: "scaleY(var(--pr, 0))" }}
      />
      <div className="space-y-16">{children}</div>
    </div>
  );
}
