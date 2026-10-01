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
import { initHoard } from './treasure.js';

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

document.addEventListener('visibilitychange', function () {
  if (document.hidden) { stop(); } else { start(); }
});
window.addEventListener('resize', function () {
  resize();
  if (!running) render(last);   /* keep a static frame on screen */
});
window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
/* === Boot ================================================================ */
/* resize() first, so the canvas has its real size before the art is built:
   the slices are drawn into offscreen canvases sized to the art, not the
   viewport, so this only has to beat the first pattern creation. */
resize();
updateDepth();
/* The hoard is wired before the sheets finish loading, so the chest buttons
   respond immediately rather than waiting on an image decode. It touches only
   the contact room, which measure() has not positioned yet - it reads no
   geometry, so the boot order costs it nothing. */
initHoard();
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
  measure();
  /* measureShaft() reports whether the viewport really changed. Only a genuine
     resize re-centres the car; a re-measure at the same size (the late font
     swap) must leave it where the reader left it, or the page would lurch. */
  var realResize = measureShaft();
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