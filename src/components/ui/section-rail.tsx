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
  /** Draw the rail. Disable for sections that sit beside a page-level rail. */
  rail?: boolean;
  /** Optional marker rendered on the rail beside this section. */
  icon?: ReactNode;
}

export function SectionRail({ children, className, inset = true, rail = true, icon }: SectionRailProps) {
  const ref = useRef<HTMLDivElement>(null);

  // The shared engine writes 0..1 travel to --sr on this element; the fill
  // scales from it. One variable name is enough because each section writes
  // its own value to its own element and the fill reads it from a descendant.
  useEffect(() => {
    if (!rail) return;
    const el = ref.current;
    if (!el) return;
    return getScrollEngine().track(el, "--sr");
  }, [rail]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {rail && (
        <>
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
        </>
      )}
      {icon && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1 flex size-10 items-center justify-center rounded-full border border-border/60 bg-card text-primary shadow-sm"
        >
          {icon}
        </span>
      )}
      {inset ? <div className="pl-14 md:pl-16">{children}</div> : children}
    </div>
  );
}

export default SectionRail;
