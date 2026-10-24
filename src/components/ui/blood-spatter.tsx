"use client";

import { useEffect } from "react";

import { useHeroLock } from "@/context/hero-lock-context";
import { createBloodSpatter } from "@/lib/blood-spatter";

export function BloodSpatter() {
  const { isLocked } = useHeroLock();

  useEffect(() => {
    if (isLocked) return;
    const instance = createBloodSpatter({
      darkMode: true,
      zIndex: 0,
      maxParticles: 8,
      minMoveDistance: 30,
      drips: false,
      spatterChance: 0.1,
      clickBurst: false,
    });
    return () => instance.destroy();
  }, [isLocked]);

  return null;
}
