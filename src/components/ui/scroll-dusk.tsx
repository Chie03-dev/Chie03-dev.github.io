"use client";

import { useEffect, useRef } from "react";

import { getScrollEngine } from "@/lib/scroll-engine";

// Peak opacity applied at the very bottom of the page, layered on top of the
// built-in vertical gradient. Kept strong enough to read as "descending into
// night" over the dark teal background, while text and opaque cards (which live
// in the z-10 content layer above this overlay) stay legible.
//
// The ceiling comes from the --dusk-max-opacity custom property, which drops
// once containment is broken (see .unbound-mode in globals.css), so unlocking
// visibly lifts the mood of the whole page.
const FALLBACK_MAX_OPACITY = 0.72;

/**
 * A fixed full-viewport dusk tint that deepens as the page scrolls, giving the
 * lower sections a progressively darker, moodier feel. It combines a vertical
 * gradient (transparent at the top of the viewport, deep at the bottom) with a
 * scroll-linked opacity ramp, so depth reads both within the viewport and across
 * the page. It sits at z-0 behind the page content (wrapped in a relative z-10
 * layer in the layout), so it darkens the transparent section backgrounds
 * without dimming text or opaque cards. Driven by the shared scroll engine;
 * pointer-events-none and aria-hidden.
 */
export function ScrollDusk() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // The engine calls back immediately and owns the single rAF loop plus the
    // reduced-motion guard (it passes 0 when motion is reduced).
    return getScrollEngine().subscribe((global) => {
      const ceiling = Number.parseFloat(
        getComputedStyle(el).getPropertyValue("--dusk-max-opacity"),
      );
      const max = Number.isFinite(ceiling)
        ? ceiling
        : FALLBACK_MAX_OPACITY;
      el.style.opacity = (global * max).toFixed(3);
    });
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ opacity: 0 }}
      className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-transparent via-black/25 to-black/80"
    />
  );
}
