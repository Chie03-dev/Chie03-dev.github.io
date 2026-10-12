"use client";

import { cn } from "@/lib/utils";

import { useHeroLock } from "@/context/hero-lock-context";

/**
 * Lock status badge shown near the hero portrait. Renders muted red while the
 * hero is contained, and the primary theme token once unbound. `aria-live`
 * announces the state change to assistive tech when unlocking runs.
 */
export function HeroLockBadge() {
  const { isLocked, isDropHot } = useHeroLock();

  return (
    <p
      aria-live="polite"
      className={cn(
        "font-mono text-xs font-medium tracking-widest",
        isDropHot
          ? "text-primary"
          : isLocked
            ? "text-red-500/80"
            : "text-primary",
      )}
    >
      {isDropHot
        ? "INSERT THE KEY // DROP TO BREAK CONTAINMENT"
        : isLocked
          ? "RESTRICTED // CONTAINMENT ACTIVE"
          : "UNBOUND // SYSTEM FULLY UNLOCKED"}
    </p>
  );
}
