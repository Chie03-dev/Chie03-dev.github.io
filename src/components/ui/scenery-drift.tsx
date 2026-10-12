"use client";

import { type CSSProperties } from "react";
import { useEffect, useRef } from "react";

import { getScrollEngine } from "@/lib/scroll-engine";

/**
 * Page-wide drifting scenery. A fixed z-0 backdrop (sibling of <ScrollDusk />,
 * painted just above its tint, both behind the z-10 content layer) that keeps
 * the hero's sky going for the whole scroll: a pair of clouds rest at their
 * base positions and are slid upward by `--sp` (the shared engine's global
 * 0..1 page progress) times their own `--d-y` travel, so the sky keeps moving
 * long after the hero band has left the viewport.
 *
 * The asset is the sunset variant's `asset-cloud` — soft enough to read the
 * same in both moods, so one set serves the sunset and moonlit states alike.
 * Everything sits at the top of the viewport at low opacity so text never
 * rests on a dense shape; transform/opacity only, and the engine pins `--sp`
 * to 0 under reduced motion (see globals.css).
 */

/** Per-element motion. `--d-y` is the upward sweep applied across full travel. */
function driftStyle(travel: string): CSSProperties {
  return { "--d-y": travel } as CSSProperties;
}

export function SceneryDrift() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // The engine calls back immediately and owns the single rAF loop plus the
    // reduced-motion guard (it passes 0 when motion is reduced).
    return getScrollEngine().subscribe((global) => {
      el.style.setProperty("--sp", global.toFixed(4));
    });
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{ "--sp": 0 } as CSSProperties}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Clouds — high and slow. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/backgroundstuff/sunset/asset-cloud.svg"
        alt=""
        draggable={false}
        className="scenery-drift absolute left-[5%] top-[7%] w-[clamp(160px,22vw,300px)] opacity-40"
        style={driftStyle("-45vh")}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/backgroundstuff/sunset/asset-cloud.svg"
        alt=""
        draggable={false}
        className="scenery-drift absolute right-[7%] top-[17%] w-[clamp(120px,16vw,220px)] opacity-25"
        style={driftStyle("-70vh")}
      />
    </div>
  );
}