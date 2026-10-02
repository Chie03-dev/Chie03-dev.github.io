/* ==========================================================================
   main.js - the frame loop and the boot sequence
   ==========================================================================
   The entry point. Owns requestAnimationFrame, the delta-time clamp, the
   visibility pause, the resize wiring and the initial boot. It is glue:
   every behaviour it calls lives in one of the other four modules.
   ========================================================================== */

import {
  measure, measureShaft, buildTextures, resizeViewport, syncScroll, setDirtTile
} from './layers.js';
import { whenSheets } from './sprites.js';
import { advanceCar, seatDeck } from './deck.js';
import { player, keys, WALK_SPEED, movePlayer, snapPlayerToGround } from './game.js';
import { seedMotes, drawMotes, render } from './render.js';
import { updateDepth, updateCue } from './ui.js';
import { initContact } from './contact.js';
/* treasure.js is GONE, along with the hoard it opened. Two things went with it:
   initHoard(), which ran once at boot to wire the chest buttons and tally the
   gold, and stepCave(), which ran every frame to highlight whichever chest the
   player was standing at and open it on approach.

   stepCave() was the only per-frame reason main.js knew anything about the
   hoard at all, so its removal is why update() below is back to being purely
   about the car, the player and the dust. The cave itself is untouched: game.js
   still hands the player over to it, render.js still draws it, and the lift
   cage still stands in it. What is gone is the furniture inside the room, not
   the room.

   `html.js` is still set on the document by the boot below, and still has to
   be: the `.js` scoped reveal rules in layout.css collapse the chambers until
   IntersectionObserver opens them, and dropping the class would flash every
   panel's contents before the observer fires. */

/* === 7. Game loop ========================================================
   requestAnimationFrame with a delta time, never setInterval. dt is clamped
   so a backgrounded tab or a long GC pause cannot teleport the player, and
   the loop is stopped entirely while the tab is hidden. */
var last = 0;
var rafId = 0;
var running = false;

function update(dt) {
  syncScroll();   /* reading scroll is layers.js's job: its binding is read-only here */
  /* Scroll -> car travel, before the player moves: the sprite must land on the
     car where it is THIS frame, not where it was last frame. */
  advanceCar(dt);

  /* Horizontal input -> velocity. Friction only applies on the ground, so
     a jump keeps its momentum. */
  var dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (dir !== 0) {
    player.vx = dir * WALK_SPEED;
    player.facing = dir;
  } else if (player.onGround) {
    player.vx = 0;
  }

  movePlayer(dt);
  /* No stepCave() any more. It used to sit here, right after the move and
     never before, because the chest highlight follows where the reader IS this
     frame - but there are no chests to highlight, and the cave's own drawing is
     driven from render() reading the player directly. */
  drawMotes(dt);      /* motes integrate here, but draw themselves */
  updateDepth();      /* gated internally: only touches the DOM on change */
  updateCue();        /* likewise: fades the scroll cue once, then stops */
}

function frame(now) {
  var dt = (now - last) / 1000;
  last = now;
  if (dt > 1 / 20) dt = 1 / 20;   /* clamp: never step more than 50ms */
  if (dt < 0) dt = 0;
  update(dt);
  render(now);
  rafId = window.requestAnimationFrame(frame);
}

function start() {
  if (running) return;
  running = true;
  last = (window.performance || Date).now();
  rafId = window.requestAnimationFrame(frame);
}
function stop() {
  running = false;
  if (rafId) window.cancelAnimationFrame(rafId);
  rafId = 0;
}

/* === Always start at the top ================================================
   The reader should always arrive at the top of the page. Without this the
   browser restores wherever they were when they left - so a reload halfway down
   the dig drops them into the middle of the cave, and a back-navigation returns
   them to wherever the previous page had put them.

   Three things, and the middle one is why it is not one line.

   `history.scrollRestoration = 'manual'` is set FIRST, before any of our own
   scrolling, because it has to be set before the browser decides what to restore.
   Once the browser has restored a scroll position, setting it afterwards restores
   nothing - the value is read at navigation time, not applied retroactively.

   The scroll-to-top runs on DOMContentLoaded as well as at boot, because the two
   are not the same moment: this module executes during parsing, when the document
   may not be tall enough to scroll yet. Scrolling a 200px-tall document to the top
   is a no-op, and the browser then restores the real position straight over it. So
   the scroll is repeated once the document has actually been measured.

   `pageshow` is handled SEPARATELY and much more narrowly, because a bfcache
   restore is not a fresh load: the reader is coming BACK to where they were, and
   that is usually what they want. Only the non-persisted case is force-corrected;
   a bfcache restore is left alone unless the page was already at the top, where
   insisting costs nothing. Anything deeper is left exactly where the browser put it.

   `behavior: 'instant'` IS EXPLICIT, and it is not optional. base.css sets
   `html{scroll-behavior:smooth}` for the depth-rail links, and a bare scrollTo(0,0)
   inherits that - so without this the jump to the top would ANIMATE, easing up a
   several-thousand-pixel page over the course of a second or more, and the reader
   would watch the whole site scroll away instead of simply arriving at the top.

   That is the same trap the pixel probe fell into, where its scroll was animated
   and it read caveActive() before the page had arrived; the fix there was the same
   keyword, for the same reason. prefers-reduced-motion needs nothing extra here,
   because an instant scroll has nothing to reduce. */
function scrollToTop() {
  try {
    if (window.scrollY > 0) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  } catch (e) {
    /* A stubbed window in the smoke suite may not accept the options form, and this
       runs at import time. Fall back to the two-argument form rather than giving up:
       a silent failure here would leave the reader stranded mid-page, which is the
       exact thing this exists to prevent. */
    try { window.scrollTo(0, 0); } catch (e2) { /* no scrollTo at all */ }
  }
}

if (window.history && 'scrollRestoration' in window.history) {
  try { window.history.scrollRestoration = 'manual'; } catch (e) { /* read-only */ }
}
scrollToTop();
document.addEventListener('DOMContentLoaded', scrollToTop);
window.addEventListener('load', scrollToTop);

window.addEventListener('pageshow', function (e) {
  /* Not a bfcache restore: an ordinary fresh load, so this is the moment the
     browser would have applied its own restoration. Undo it. */
  if (!e.persisted) { scrollToTop(); return; }
  /* A bfcache restore, where the reader is returning to their own place. Leave it
     alone unless they were at the very top, where restoring the top is the same
     position and so costs nothing to insist on. */
  if (window.scrollY > 1) return;
  scrollToTop();
});

document.addEventListener('visibilitychange', function () {
  if (document.hidden) { stop(); } else { start(); }
});
window.addEventListener('resize', function () {
  resize();
  if (!running) render(last);   /* keep a static frame on screen */
});
window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
/* === Boot ================================================================ */
/* The hoard is gone, so the boot no longer has an early wiring step before the
   sheets load. resize() still runs first, so the canvas has its real size
   before the art is built: the slices are drawn into offscreen canvases sized
   to the art, not to the viewport, so this only has to beat the first pattern
   creation. */
resize();
updateDepth();
/* Contact first: it only reads attributes and swaps a span for an anchor, so it
   cannot throw, and running it before whenSheets() means the links are live even
   if a sprite sheet is slow or missing. A contact block that only appears once
   the art has loaded is a contact block that fails to appear at all. */
initContact();
whenSheets(function (a) {
  /* The dirt tile is gone from the sheets, so the renderer is told so plainly and
     buildTextures() falls back to its own baked grit per band - which is what it
     did before the tile was introduced. Passing null rather than leaving the
     previous tile in place matters because a stale tile would outlive its own
     removal. buildTextures() is idempotent, so re-running it here is the whole
     re-bake rather than a second code path to keep in step with it. */
  setDirtTile(null);
  buildTextures();
  start();
  if (!running) render(last);
});

/* Late layout shifts (font swap, scrollbar changes) need a re-measure. The
   shaft is part of that: its width comes from clamp(140px,24vw,220px).
   seatDeck(false) rather than a re-centre, because a font swap changes the page
   height without changing the viewport - the reader has not asked for a new
   view, so the car keeps its place and is merely re-clamped into the band. */
window.addEventListener('load', function () {
  measure();
  measureShaft();
  seatDeck(false);
  updateDepth();
  if (!running) render(last);
});
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function () {
    measure();
    measureShaft();
    seatDeck(false);
    updateDepth();
  });
}

function resize() {
  resizeViewport();
  buildTextures();
  /* The side rooms' settle timer is cleared here, and only here. A resize moves
     every room box under the reader, which rooms.js would otherwise see as the
     scroll having changed - dropping somebody already standing in a gallery
     back onto the car for a quarter of a second every time they nudged the
     window edge.

     Deliberately in resize() rather than in measure(): measure() also runs on
     every scroll, and clearing on scroll would defeat the entire settle rule. */
  /* measureShaft() BEFORE measure(). measure() is what hands the cage at the
     foot of the shaft its x and width, and layers.js holds those numbers in
     shaftX/shaftW - which are still 0 at this point on the first boot, so the
     cage would be measured against a shaft that does not exist yet and fall
     back to its centred default. Measuring the shaft first means the cage gets
     the real channel on the very first frame instead of correcting itself one
     resize later.

      measureShaft() only reads the DOM and writes this module's own numbers, so
      running it earlier is safe; measure() does not depend on the shaft. */
  var realResize = measureShaft();
  measure();
  /* measureShaft() reports whether the viewport really changed. Only a genuine
     resize re-centres the car; a re-measure at the same size (the late font
     swap) must leave it where the reader left it, or the page would lurch. */
  seatDeck(realResize);
  snapPlayerToGround();
  seedMotes();
}

/* Public surface. main.js is the entry point that index.html loads, so it has no
   consumers - but resize() is exported so tools/smoke.mjs can drive the REAL
   boot sequence instead of re-implementing it. It used to re-implement it, and
   it drifted: the copy called four of resize()'s seven steps and silently
   skipped seedMotes(), so a ReferenceError inside that one function was
   invisible to the harness while a browser died on it and showed a black
   canvas. */
export { resize };
