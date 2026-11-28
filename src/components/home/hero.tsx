"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { ChainsOverlay } from "@/components/ui/chains-overlay";
import { useHeroLock } from "@/context/hero-lock-context";
import { getScrollEngine } from "@/lib/scroll-engine";
import { cn } from "@/lib/utils";

/**
 * The cinematic hero portrait, ported from the showcase hero
 * (src/components/showcases/hero.tsx) into the live hero column.
 *
 * The portrait carries its containment cage, in layers:
 *  - a radial vignette that hugs the frame and is present only while the hero
 *    is chained,
 *  - a drop-zone outline that flares while a carried key hovers the cage
 *    (see KeyGuardian, which hit-tests #hero-portrait by ID),
 *  - the chain simulation itself, riding the photo through one clamped rigid
 *    transform so the cage and the portrait never separate.
 *
 * The scroll engine writes this section's 0..1 travel to --hp, which drives the
 * `hero-exit` hand-off: the portrait holds full opacity until the hero is well
 * past the fold, then lifts and fades instead of simply scrolling away.
 *
 * A client component because the cage, the vignette and the scroll-linked exit
 * are all state/scroll driven - there is no static version of this portrait.
 */
export default function Hero() {
  const { isLocked, isDropHot } = useHeroLock();
  const sectionRef = useRef<HTMLElement>(null);

  // Owned by the shared scroll engine (single rAF + reduced-motion guard), so
  // the exit costs no listener of its own.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    return getScrollEngine().track(el, "--hp");
  }, []);

  return (
    // The cage canvas is deliberately oversized (18rem of headroom on a side),
    // so the column clips it: nothing spills into the page beside it, and the
    // page never gains a horizontal scrollbar on mobile. The height is sized to
    // the cage itself (portrait plus its headroom) rather than to the viewport,
    // because the About now stacks underneath the portrait in this column.
    //
    // On wide desktops the clip is widened 6rem to the LEFT - into the empty
    // page margin, never into the content column - and the portrait is centred
    // inside that wider box. That biases the portrait clear of the column's
    // centre while still leaving the cage its full swing room, instead of
    // trading the shift for cage bars clipped at the column edge. Scoped to xl
    // because narrower desktops do not have the margin to give.
    <section
      ref={sectionRef}
      className="relative flex h-[440px] w-full items-center justify-center overflow-hidden xl:-ml-24 xl:w-[calc(100%+6rem)]"
    >
      <div className="hero-exit flex w-full items-center justify-center">
        <div
          id="hero-portrait"
          className="relative isolate w-full max-w-[240px] md:max-w-[320px]"
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
              exactly - the same rect the drop hit-test uses, with no extra
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

          {/* The photo and its cage share one box, so the mask fade grounds the
              portrait into the page instead of ending on a hard cut. */}
          <div className="relative w-full" data-cage-drift>
            <Image
              src="/portrait.webp"
              alt="Portrait of Alchie O. Andilab"
              width={380}
              height={380}
              priority
              sizes="(max-width: 767px) 240px, 320px"
              className="h-auto w-full [mask-image:linear-gradient(to_bottom,black_75%,transparent_100%)] object-cover"
            />
            <ChainsOverlay isLocked={isLocked} />
          </div>
        </div>
      </div>
    </section>
  );
}
