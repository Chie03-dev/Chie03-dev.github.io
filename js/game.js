/* ==========================================================================
   game.js - the simulation: player, collision and input
   ==========================================================================
   The part a visitor actually plays. Owns the player object, the physics
   constants, the flat-deck collision resolve, the keyboard handlers and the
   jump.

   Deliberately holds no drawing code and never touches the 2d context.
   That restraint is what keeps the modules a one-way chain rather than a
   tangle of imports.
   ========================================================================== */

import {
  clamp, shaftLeft, shaftRight, shaftMid, SPRITE_W, SPRITE_H
} from './layers.js';
import { groundY, deckBounds } from './deck.js';

/* Physics constants, in CSS pixels and seconds. */
var WALK_SPEED = 95;    /* px/s    */
var GRAVITY    = 2400;  /* px/s^2  */
var JUMP_V     = 540;   /* px/s, negative = upward */

var player = {
  x: 0, y: 0, w: SPRITE_W, h: SPRITE_H,
  vx: 0, vy: 0, facing: 1, onGround: true
};
function snapPlayerToGround() {
  var minX = shaftLeft() + 4;
  var maxX = shaftRight() - 4 - player.w;
  if (maxX < minX) { maxX = minX; }          /* shaft narrower than the sprite */
  player.x = clamp(player.x, minX, maxX);
  if (!isFinite(player.x) || player.x === 0) player.x = Math.round(shaftMid() - player.w / 2);
  player.y = groundY() - player.h;
  player.vx = player.vy = 0;
}
/* === Collision ===========================================================
   The car floor is one flat line, so the only solid surfaces in the game are
   that line and the two shaft walls. There is no height field and no step-up:
   walking is horizontal only, and the only things that move the sprite
   vertically are gravity and the car rising under it.

   Vertical is therefore three steps: integrate gravity, land on the deck, then
   clamp the head. That last clamp is what actually bounds the character, and
   it is a hard bound rather than a soft one. A jump peaks at
   JUMP_V^2 / (2 * GRAVITY) = 60.75px, and one taken at the very top of the
   car's travel range would otherwise put the head through the shaft mouth.
   Cutting the jump short reads as landing on an invisible ceiling, which is
   exactly what it is, and beats the sprite leaving the shaft.

   The old version of this function sampled a groundY(x) height field, compared
   the rise against a MAX_STEP tolerance, and teleported the player back to
   where its feet started whenever the surface moved further than that. On
   sloping ground that meant the character was being shoved around by a
   function of its own horizontal position. The floor is flat now, so none of
   it is needed.
   ======================================================================== */
function movePlayer(dt) {
  var minX = shaftLeft() + 4;
  var maxX = shaftRight() - 4 - player.w;
  if (maxX < minX) maxX = minX;         /* shaft narrower than the sprite */

  /* --- horizontal: integrate, then push out of the shaft walls --- */
  player.x += player.vx * dt;
  if (player.x < minX) { player.x = minX; player.vx = 0; }
  if (player.x > maxX) { player.x = maxX; player.vx = 0; }

  /* --- vertical: gravity, then the deck --- */
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;

  if (player.y + player.h >= groundY()) {
    player.y = groundY() - player.h;    /* standing on the car floor */
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;            /* airborne */
  }

  /* --- vertical bound: the head may rise, but never out of the shaft --- */
  var ceiling = deckBounds().top - player.h;
  if (player.y < ceiling) {
    player.y = ceiling;
    if (player.vy < 0) player.vy = 0;   /* stop rising, let gravity resume */
  }
}
/* === 6. Input ============================================================
   Keyboard only, and deliberately narrow: A/D (or the left/right arrows) walk,
   W jumps. Up and down are NOT captured, and that is now load-bearing rather
   than a nicety: scrolling is what drives the car, so swallowing the arrow
   keys that scroll the page would fight the very mechanic they sit next to.
   Nothing here scroll-jacks.

   Space is deliberately left unbound and never preventDefault-ed, so it keeps
   its native meaning (scrolling the page, activating a focused button) and
   stays free for a later feature to claim. */
var keys = Object.create(null);

function onKeyDown(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  var k = e.key ? e.key.toLowerCase() : '';
  /* Never steal keys from a focused control (buttons, links). */
  var t = e.target;
  if (t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'INPUT')) return;

  if (k === 'a' || k === 'arrowleft')       { keys.left = true;  e.preventDefault(); }
  else if (k === 'd' || k === 'arrowright') { keys.right = true; e.preventDefault(); }
  else if (k === 'w' && !e.repeat)          { jump(); }
}
function onKeyUp(e) {
  var k = e.key ? e.key.toLowerCase() : '';
  if (k === 'a' || k === 'arrowleft')        keys.left = false;
  else if (k === 'd' || k === 'arrowright') keys.right = false;
}
function jump() {
  if (!player.onGround) return;
  player.vy = -JUMP_V;
  player.onGround = false;
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
/* Losing focus mid-stride should not leave the player running. */
window.addEventListener('blur', function () { keys.left = keys.right = false; });

/* Public surface of this module. Collected here so that not one line of
   the code above needed a keyword added to it. */
export {
  player,
  keys,
  WALK_SPEED,
  movePlayer,
  snapPlayerToGround
};
