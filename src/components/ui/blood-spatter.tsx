"use client";

import { useEffect } from "react";

import { useHeroLock } from "@/context/hero-lock-context";
import { createBloodSpatter } from "@/lib/blood-spatter";

export function BloodSpatter() {
  const { isLocked } = useHeroLock();

  useEffect(() => {
    if (isLocked) return;
    // Reduce blood animation intensity by ~75% in dark mode so it's less
    // overwhelming against the dark background.
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const instance = createBloodSpatter({
      darkMode: true,
      zIndex: 0,
      maxParticles: dark ? 2 : 8,
      minMoveDistance: 30,
      drips: false,
      spatterChance: dark ? 0.025 : 0.1,
      clickBurst: false,
      splatLifeMs: dark ? 1000 : 4000,
      woundLifeMs: dark ? 3500 : 14000,
      clawCooldown: dark ? 2800 : 700,
    });
    return () => instance.destroy();
  }, [isLocked]);

  return null;
}
