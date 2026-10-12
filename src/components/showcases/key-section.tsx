import { Reveal } from "@/components/ui/reveal";
import { KeyVault } from "@/components/showcases/key-vault";

/**
 * The Vault Key section — the guardian's own band. The hero starts chained, and
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
      <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 lg:px-8 lg:pt-20">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            The Vault Key
          </h2>
        </Reveal>
      </div>
      <KeyVault />
    </section>
  );
}
