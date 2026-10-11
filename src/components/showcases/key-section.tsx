import { cn } from "@/lib/utils";
import { MonsterEyes } from "@/components/ui/monster-eyes";
import { UnlockKey } from "@/components/ui/unlock-key";
import { Reveal } from "@/components/ui/reveal";

export function KeySection() {
  return (
    <section id="key" className="relative isolate py-20 lg:py-28 overflow-hidden border-t border-border/40 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center">
        <Reveal className="mb-12 max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            The Vault Key
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Watched over by the watcher in the murk. Drag or use the key to unlock the hero experience.
          </p>
        </Reveal>
        <div className="relative isolate py-8">
          <MonsterEyes />
          <UnlockKey />
        </div>
      </div>
    </section>
  );
}