"use client";

import { useEffect } from "react";

import { useHeroLock } from "@/context/hero-lock-context";
import { createBloodSpatter } from "@/lib/blood-spatter";

export function BloodSpatter() {
  const { isLocked } = useHeroLock();

  useEffect(() => {
    if (isLocked) return;
    const instance = createBloodSpatter({ darkMode: true, zIndex: 0 });
    return () => instance.destroy();
  }, [isLocked]);

  return null;
}
