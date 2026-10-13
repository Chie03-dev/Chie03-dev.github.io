"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { getScrollEngine } from "@/lib/scroll-engine";
import { cn } from "@/lib/utils";

/**
 * Timeline - a vertical rail whose progress fills as the section scrolls, with
 * each entry's title stuck to the rail while its content scrolls past.
 *
 * Adapted to this site: the gradient colours come from the theme tokens rather
 * than hard-coded neutrals, so the fill follows the accent (amber by default,
 * violet in the unlocked pitch-black theme) and reads correctly in both.
 *
 * The fill is driven by the shared scroll engine, which already runs for the
 * hero hand-off and the dusk overlay, so this costs one tracked element rather
 * than a second scroll listener or an animation library.
 */

export interface TimelineEntry {
  title: string;
  content: ReactNode;
  /** Node content; defaults to a plain dot. Passed as JSX so it can be built
   *  in a Server Component and still cross into this client leaf. */
  node?: ReactNode;
}

interface TimelineProps {
  data: TimelineEntry[];
  className?: string;
}

export function Timeline({ data, className }: TimelineProps) {
  const ref = useRef<HTMLDivElement>(null);

  // The engine writes 0..1 "travelled through the viewport" progress to --tl
  // on this element; CSS scales the fill from it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return getScrollEngine().track(el, "--tl");
  }, []);

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {data.map((item, index) => (
        <div
          key={index}
          className="flex justify-start pt-10 md:pt-16 md:gap-10"
        >
          {/* The node and the title are one sticky unit, so both hold while the
              entry's content scrolls past them. */}
          <div className="sticky top-24 z-40 flex flex-col items-center self-start md:flex-row md:items-center">
            <span className="absolute left-0 flex size-10 items-center justify-center rounded-full border border-border/60 bg-card text-primary shadow-sm">
              {item.node ?? <span className="size-3 rounded-full bg-primary" />}
            </span>
            <h3 className="mt-12 hidden text-center text-sm font-bold tracking-tight text-muted-foreground uppercase md:mt-0 md:ml-14 md:block md:text-left md:text-2xl md:normal-case">
              {item.title}
            </h3>
          </div>

          <div className="w-full pr-2 pl-14 md:pl-4">
            <h3 className="mb-3 text-left text-xl font-bold tracking-tight text-muted-foreground md:hidden">
              {item.title}
            </h3>
            {item.content}
          </div>
        </div>
      ))}

      {/* The rail: a gradient that fades at both ends, masked the same way, so
          it never ends on a hard edge. The base sits brighter than the cards'
          hairlines so the timeline still reads as a track once the fill has
          passed a section. */}
      <div
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-[19px] w-[2px] overflow-hidden bg-gradient-to-b from-transparent via-muted-foreground/25 to-transparent [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)]"
      >
        {/* The fill. Scaled from the top by the scroll engine's --tl, so it
            draws itself in as the timeline travels up the viewport. */}
        <div
          className="absolute inset-x-0 top-0 h-full w-[2px] origin-top rounded-full bg-gradient-to-t from-primary/10 via-primary to-primary"
          style={{ transform: "scaleY(var(--tl, 0))" }}
        />
      </div>
    </div>
  );
}

export default Timeline;
