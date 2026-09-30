/* ==========================================================================
   main.js - the frame loop and the boot sequence
   ==========================================================================
   The entry point. Owns requestAnimationFrame, the delta-time clamp, the
   visibility pause, the resize wiring and the initial boot. It is glue:
   every behaviour it calls lives in one of the other four modules.
   ========================================================================== */

import {
  measure, measureShaft, buildTextures, resizeViewport, syncScroll
} from './layers.js';
import { advanceCar, seatDeck } from './deck.js';
import { player, keys, WALK_SPEED, movePlayer, snapPlayerToGround } from './game.js';
import { seedMotes, drawMotes, render } from './render.js';
import { updateDepth, updateCue } from './ui.js';

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
resize();
updateDepth();
start();

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