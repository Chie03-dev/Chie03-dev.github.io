"use client";

import { useHeroLock } from "@/context/hero-lock-context";
import { cn } from "@/lib/utils";

/**
 * Lock status badge shown near the hero portrait. Renders muted red while the
 * hero is contained, and the primary theme token once unbound. `aria-live`
 * announces the state change to assistive tech when unlocking runs.
 */
export function HeroLockBadge() {
  const { isLocked } = useHeroLock();

  return (
    <p
      aria-live="polite"
      className={cn(
        "font-mono text-xs font-medium tracking-widest",
        isLocked ? "text-red-500/80" : "text-primary",
      )}
    >
      {isLocked
        ? "RESTRICTED // CONTAINMENT ACTIVE"
        : "UNBOUND // SYSTEM FULLY UNLOCKED"}
    </p>
  );
}
