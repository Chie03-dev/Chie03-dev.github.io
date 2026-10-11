"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

const UNBOUND_CLASS = "unbound-mode";

interface HeroLockContextValue {
  isLocked: boolean;
  isKeyDragging: boolean;
  isDropHot: boolean;
  unlockHero: () => void;
  lockHero: () => void;
  setKeyDragging: (dragging: boolean) => void;
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
 * Also carries the key-drag flag plus the drop-hot flag (key hovering the
 * cage) so the cage glow flares only on a real hover, not any drag.
 *
 * `document` is only touched in event handlers, so server rendering stays
 * side-effect free and hydration is unaffected.
 */
export function HeroLockProvider({ children }: HeroLockProviderProps) {
  const [isLocked, setIsLocked] = useState(true);
  const [isKeyDragging, setKeyDragging] = useState(false);
  const [isDropHot, setDropHot] = useState(false);

  function unlockHero() {
    setIsLocked(false);
    setKeyDragging(false);
    setDropHot(false);
    document.documentElement.classList.add(UNBOUND_CLASS);
  }

  function lockHero() {
    setIsLocked(true);
    setKeyDragging(false);
    setDropHot(false);
    document.documentElement.classList.remove(UNBOUND_CLASS);
  }

  const value: HeroLockContextValue = {
    isLocked,
    isKeyDragging,
    isDropHot,
    unlockHero,
    lockHero,
    setKeyDragging,
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
