"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { setDarkTheme } from "@/lib/theme";

const UNBOUND_CLASS = "unbound-mode";

interface HeroLockContextValue {
  isLocked: boolean;
  /** True while a dragged key hovers the hero's cage, to flare the drop zone. */
  isDropHot: boolean;
  /**
   * Bumped once per unlock. <UnlockFlash /> keys its DOM off this so the CSS
   * sequence replays from a clean mount rather than resuming mid-animation.
   */
  flashId: number;
  unlockHero: () => void;
  lockHero: () => void;
  setDropHot: (hot: boolean) => void;
}

interface HeroLockProviderProps {
  children: ReactNode;
}

const HeroLockContext = createContext<HeroLockContextValue | null>(null);

/**
 * Tracks whether the hero is locked or unlocked, and mirrors that state onto
 * <html> as the `unbound-mode` class so globals.css can restyle the site.
 * Every visit starts locked; unlocking lasts for the session only.
 *
 * The containment state also owns the theme: locked always renders the default
 * navy, and breaking containment drops the site into the pitch-black `.dark`
 * variant (see src/lib/theme.ts). The navbar toggle is there to step back out
 * of it, not to reach it.
 *
 * The guardian game in the Key section is the intended way to unlock: the key is
 * dragged out of that band and dropped on the hero's cage. `isDropHot` carries
 * that hover so the cage can flare as a drop target.
 *
 * `document` is only touched in event handlers, so server rendering stays
 * side-effect free and hydration is unaffected.
 */
export function HeroLockProvider({ children }: HeroLockProviderProps) {
  const [isLocked, setIsLocked] = useState(true);
  const [isDropHot, setDropHot] = useState(false);
  const [flashId, setFlashId] = useState(0);

  function unlockHero() {
    setIsLocked(false);
    setDropHot(false);
    // Drives the break-containment flash. Every unlock path reaches here, so
    // the effect fires no matter how containment was broken.
    setFlashId((n) => n + 1);
    document.documentElement.classList.add(UNBOUND_CLASS);
    // Breaking containment is also what earns the pitch-black theme, so the
    // site drops into it here rather than waiting for the visitor to go
    // looking for a toggle.
    setDarkTheme(true);
  }

  function lockHero() {
    setIsLocked(true);
    setDropHot(false);
    document.documentElement.classList.remove(UNBOUND_CLASS);
    // Re-caged: the dark theme is locked away again too.
    setDarkTheme(false);
  }

  const value: HeroLockContextValue = {
    isLocked,
    isDropHot,
    flashId,
    unlockHero,
    lockHero,
    setDropHot,
  };

  return (
    <HeroLockContext.Provider value={value}>
      {children}
    </HeroLockContext.Provider>
  );
}

/**
 * Read the hero lock state. Throws when used outside HeroLockProvider so a
 * missing provider fails loudly instead of silently.
 */
export function useHeroLock(): HeroLockContextValue {
  const context = useContext(HeroLockContext);
  if (!context) {
    throw new Error("useHeroLock must be used within HeroLockProvider");
  }
  return context;
}
