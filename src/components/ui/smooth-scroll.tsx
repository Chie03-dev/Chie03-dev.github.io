"use client";

import { useEffect } from "react";

import Lenis from "lenis";

/**
 * Inertial smooth scrolling for the whole page.
 *
 * Native wheel/trackpad scrolling is linear and steppy; premium portfolio
 * sites layer an inertial "glide" on top so the page eases into motion and
 * settles with momentum. Lenis is the small (~3kb) standard for this -it
 * intercepts wheel input and animates `window.scrollTo` on its own rAF, so
 * the existing ScrollEngine keeps working untouched (Lenis still fires real
 * scroll events every frame).
 *
 * Accessibility: when the visitor prefers reduced motion we never start Lenis,
 * so scrolling stays instant and native. The reduced-motion media query is
 * watched so toggling the OS setting live starts/stops it correctly.
 *
 * Client-only by construction (a no-render effect component).
 */
export function SmoothScroll() {
  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    let lenis: Lenis | null = null;
    let rafId = 0;

    const start = () => {
      if (lenis) return;
      lenis = new Lenis({
        // A touch more glide than the library default (1 / 0.7s feel) without
        // going floaty: snappy lift, gentle settle.
        lerp: 0.09,
        smoothWheel: true,
        // Keep native behaviour for touch (mobile momentum is already good and
        // hijacking it feels worse, not better).
        syncTouch: false,
        // Route in-page hash links (navbar, "Key to the Cage", "Get in Touch",
        // "back to top") through Lenis so they glide too, instead of jumping.
        anchors: true,
      });

      const raf = (time: number) => {
        lenis?.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);
    };

    const stop = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      lenis?.destroy();
      lenis = null;
    };

    const sync = () => {
      if (motionQuery.matches) stop();
      else start();
    };

    sync();
    motionQuery.addEventListener("change", sync);

    return () => {
      motionQuery.removeEventListener("change", sync);
      stop();
    };
  }, []);

  return null;
}
