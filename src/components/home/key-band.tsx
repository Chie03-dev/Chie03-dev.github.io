"use client";

import dynamic from "next/dynamic";
import { useHeroLock } from "@/context/hero-lock-context";

const KeyVault = dynamic(
  () => import("@/components/showcases/key-vault").then((m) => m.KeyVault),
  {
    ssr: false,
    loading: () => <div className="h-40" aria-hidden="true" />,
  },
);

/**
 * The vault key band at the foot of the contact section. The guardian clutches
 * the key that breaks the hero's containment: it is dragged out of this band
 * and dropped on the portrait's cage up at the top of the page.
 *
 * A client leaf only because it has to disappear once containment is broken -
 * the game itself (KeyVault) already unmounts in that state, and this wrapper
 * takes its heading and hint with it so no empty band is left behind.
 */
export function KeyBand() {
  const { isLocked } = useHeroLock();

  if (!isLocked) return null;

  return (
    <div id="key" className="mt-12 border-t border-border/40 pt-8">
      <div className="mb-2 flex items-center gap-3">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Key to the Cage
        </h3>
        <span className="h-px flex-1 bg-border/60" aria-hidden="true" />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Drag the key out of the guardian&rsquo;s band and drop it on the
        portrait&rsquo;s cage to break containment.
      </p>
      <KeyVault />
    </div>
  );
}
