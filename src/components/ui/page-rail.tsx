"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { getScrollEngine } from "@/lib/scroll-engine";
import { cn } from "@/lib/utils";

/**
 * A single rail that spans the whole right-hand content column, so the
 * timeline reads as one continuous spine instead of one rail per section.
 */
export function PageRail({ children, className }: { children: ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const engine = getScrollEngine();
    const unsubscribe = engine.subscribe((global) => {
      if (fillRef.current) {
        fillRef.current.style.transform = `scaleY(${engine.reducedMotion ? 0 : global})`;
      }
    });
    return unsubscribe;
  }, []);

  return (
    <div ref={containerRef} className={cn("relative min-w-0 space-y-16", className)}>
      <span
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-[19px] w-[2px] overflow-hidden bg-gradient-to-b from-transparent via-muted-foreground/25 to-transparent [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)]"
      />
      <span
        ref={fillRef}
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-[19px] w-[2px] origin-top rounded-full bg-gradient-to-t from-primary/10 via-primary to-primary"
        style={{ transform: "scaleY(0)" }}
      />
      {children}
    </div>
  );
}
