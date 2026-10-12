"use client";

import { useEffect, useRef } from "react";

import { useHeroLock } from "@/context/hero-lock-context";

/*
 * Break-containment flash. A one-shot, full-viewport overlay that fires the
 * instant the cage unlocks: a hard black/red snap with the werewolf howling at
 * the full moon, then the whole thing fades off the screen. Runs for 2s.
 *
 * It is decorative by construction -aria-hidden and pointer-events-none, so it
 * can never eat a click or announce itself to assistive tech.
 *
 * Two costs stay near zero:
 *  - The overlay renders nothing until containment breaks (`flashId` starts at
 *    0 and only unlockHero() moves it), so a visitor who never unlocks ships no
 *    extra overlay DOM for this.
 *  - When it does fire, `key={flashId}` makes React remount the overlay, which
 *    restarts the CSS sequence from frame zero. No JS animation, no library —
 *    globals.css owns the timing, and only opacity/transform animate so the
 *    whole thing stays on the compositor.
 *
 * The <audio> element is the one thing that stays mounted. It is small, has no
 * visual box, and is preloaded so the sting lands on the same frame as the
 * flash instead of stalling on a fetch mid-effect.
 *
 * The overlay is intentionally left mounted after it ends: it finishes at
 * opacity 0, so it costs no paint, and dropping it manually would desync
 * React's view of the DOM from the real one.
 */
export function UnlockFlash() {
  const { flashId } = useHeroLock();
  const audioRef = useRef<HTMLAudioElement>(null);

  // Play the sting once per unlock. Driven from an effect rather than the
  // `autoPlay` attribute so a later re-lock/unlock replays it instead of
  // staying silent the second time. `.play()` can still reject under autoplay
  // policy, so the rejection is swallowed -the visual flash must never depend
  // on sound actually starting.
  useEffect(() => {
    if (flashId === 0) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* Autoplay blocked. The flash plays on regardless. */
    });
  }, [flashId]);

  return (
    <>
      {flashId > 0 && (
        <div
          key={flashId}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[150] isolate overflow-hidden"
        >
          {/* Wolf artwork: desaturated and pushed on contrast so the red pulse
              below reads as blood-tinted rather than merely bright. */}
          <div className="unlock-flash-art" />

          {/* Red bloom. Blend mode tints the artwork instead of covering it. */}
          <div className="unlock-flash-red" />

          {/* Hard black strobe sitting in front of everything. Gives the "flash"
              its punch: two quick blackouts that reveal the wolf underneath. */}
          <div className="unlock-flash-black" />
        </div>
      )}

      {/* The sting. No controls and no box, so it is invisible and takes no
          layout; aria-hidden keeps it out of the accessibility tree. */}
      <audio
        ref={audioRef}
        src="/lamaw.mp3"
        preload="auto"
        aria-hidden="true"
      />
    </>
  );
}