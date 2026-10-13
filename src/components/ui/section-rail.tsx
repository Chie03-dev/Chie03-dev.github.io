"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { getScrollEngine } from "@/lib/scroll-engine";
import { cn } from "@/lib/utils";

/**
 * A section rail: the same graduated rail the Experience timeline uses, drawn
 * beside a whole section and filled by scroll progress.
 *
 * Every section on the page carries one, so the rail reads as a spine running
 * down the content rather than as a decoration on a single section. The fill
 * tracks THIS section's own travel, so each rail fills while you are reading
 * that section and is empty when you are not.
 *
 * The geometry matches the Timeline's rail exactly (2px at left-[19px], dot
 * centred on it), so the two line up when a Timeline sits inside a section
 * that has one.
 */

interface SectionRailProps {
  children: ReactNode;
  className?: string;
  /** Content wrapper width; sections usually want the full width minus the rail. */
  inset?: boolean;
}

export function SectionRail({ children, className, inset = true }: SectionRailProps) {
  const ref = useRef<HTMLDivElement>(null);

  // The shared engine writes 0..1 travel to --sr on this element; the fill
  // scales from it. One variable name is enough because each section writes
  // its own value to its own element and the fill reads it from a descendant.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return getScrollEngine().track(el, "--sr");
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* The rail: transparent at both ends, masked the same way, so it never
          stops on a hard edge. */}
      <span
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-[19px] w-[2px] overflow-hidden bg-gradient-to-b from-transparent via-muted-foreground/25 to-transparent [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)]"
      />
      {/* The fill: scaled from the top by the section's own progress. */}
      <span
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-[19px] w-[2px] origin-top rounded-full bg-gradient-to-t from-primary/10 via-primary to-primary"
        style={{ transform: "scaleY(var(--sr, 0))" }}
      />
      {inset ? <div className="pl-14 md:pl-16">{children}</div> : children}
    </div>
  );
}

export default SectionRail;
