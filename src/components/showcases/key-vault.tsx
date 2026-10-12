"use client";

import { KeyGuardian } from "@/components/ui/key-guardian";
import { useHeroLock } from "@/context/hero-lock-context";

/**
 * The playable half of the Key section, split out of key-section.tsx so the
 * title and layout stay server-rendered and only this leaf ships to the client.
 *
 * Rendered at the section level (not inside the heading's max-w-2xl wrapper) so
 * the guardian band runs full-bleed.
 *
 * The section carries no explanatory copy — the title in key-section.tsx is the
 * only text — so this renders the scene and nothing else while locked. Once
 * unbound the band clears out entirely; the hero terminal reports the new state.
 *
 * The key is won by carrying it out of this band and dropping it on the hero's
 * cage — both the canvas drop and the keyboard fallback call onClaim. The hover
 * state is reported through onDropHot so the cage can flare as a drop target.
 */
export function KeyVault() {
  const { isLocked, unlockHero, setDropHot } = useHeroLock();

  if (!isLocked) return null;

  return <KeyGuardian onClaim={unlockHero} onDropHot={setDropHot} />;
}
