import { KeyVault } from "@/components/showcases/key-vault";

/**
 * The Vault Key section -the guardian's own band. The hero starts chained, and
 * this is where the visitor takes the key: grab it, carry it past the guardian,
 * and drop it on the cage up in the hero. Winning calls unlockHero(), which drops the site-wide
 * containment (chains, vignette, badge) for the rest of the session.
 *
 * Deliberately copy-free: the title is the only text, and the scene itself is
 * the explanation. A Server Component; only the game (KeyVault) is client-side.
 */
export function KeySection() {
  return (
    <section id="key" className="relative isolate border-t border-border/40">
      {/*
        Rendered at the section level rather than inside the heading's wrapper so
        the guardian band can run edge to edge.
      */}
      <KeyVault />
    </section>
  );
}
