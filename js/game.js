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
import { caveActive, caveBounds, screenFloorY, enterCave, leaveCave,
         caveRoof } from './cave.js';

/* Physics constants, in CSS pixels and seconds. */
var WALK_SPEED = 95;    /* px/s    */
var GRAVITY    = 2400;  /* px/s^2  */
var JUMP_V     = 540;   /* px/s, negative = upward */

var player = {
  x: 0, y: 0, w: SPRITE_W, h: SPRITE_H,
  vx: 0, vy: 0, facing: 1, onGround: true,
  /* Which world owns the player: the shaft, or the bedrock cave. Read by
     movePlayer() to decide which collision function runs, and by the renderer
     to decide whether the car is still worth drawing. Starts in the shaft,
     because the page opens at the top where there is no cave. */
  inCave: false
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
/* === Cave collision =========================================================
   Inside the treasure room the solid surfaces are the CAVE, not the shaft: the
   floor is an undulating line and the walls are the edges of the screen. The
   shaft keeps its own flat-deck rule, untouched, for everywhere else on the page.

   Kept as a separate function rather than a branch inside movePlayer() because
   the two are genuinely different worlds - a height field against a flat line -
   and threading one through the other with a flag is how the shaft's carefully
   argued flat-deck behaviour would quietly start reading a terrain sample.

   Step-up is capped rather than free-climbing, for the reason the shaft's version
   spells out: a height field sampled at the player's own x will, on a slope, ask
   the sprite to climb a rise it could not jump. Anything steeper than the jump
   apex (60.75px) is refused, and the player is stopped at its foot. */
var CAVE_STEP = 14;    /* max rise the player walks up without jumping */

/* The cave roof, in screen space. Delegates to cave.js's caveRoof(), which clamps
   the height to the viewport - the 300x200 case is why that clamp exists, and
   recomputing the height here is how it would be bypassed. */
function caveCeiling() {
  return caveRoof();
}

/* CAVE_HEIGHT itself lives in cave.js, next to the floor it measures up from:
   the renderer places the void behind the rock using the same roof the collision
   clamps the head against, and a ceiling the renderer had to restate is a
   ceiling that can stop being the one the player bumps into. */

function movePlayerCave(dt, player) {
  var b = caveBounds();

  /* --- horizontal: integrate, then the cave walls --- */
  player.x += player.vx * dt;
  if (player.x < b.left) { player.x = b.left; player.vx = 0; }
  if (player.x > b.right - player.w) { player.x = b.right - player.w; player.vx = 0; }

  /* --- vertical: gravity, then the floor --- */
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;

  /* Sampled at the player's CENTRE, not at their feet. A width sample straddles
     a rise and returns whichever end it hits first, which makes the sprite
     judder as they walk a slope - the same class of bug as the tree crawl, and
     for the same reason: two consumers of one curve that do not agree on where
     to read it. */
  var ground = screenFloorY(player.x + player.w / 2);

  if (player.y + player.h >= ground) {
    var rise = ground - (player.y + player.h);
    /* Climbing something too steep to jump reads as hitting an invisible wall,
       which is what it is, and beats teleporting up a slope. */
    if (player.vy > 0 && rise > CAVE_STEP && !player.onGround) {
      player.vy = 0;
    } else {
      player.y = ground - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  } else {
    player.onGround = false;      /* airborne */
  }

  /* --- ceiling: the cave roof, so a jump cannot leave the room --- */
  var ceiling = caveCeiling() - player.h;
  if (player.y < ceiling) {
    player.y = ceiling;
    if (player.vy < 0) player.vy = 0;
  }
}

/* === Shaft collision =========================================================
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

   THE CAVE IS NOT THIS. It has a height field, by design, and lives in
   movePlayerCave() above - deliberately not folded in here, so that this
   function's flat-deck reasoning stays exactly as true as it was written. */
function movePlayerShaft(dt, player) {
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

/* === The handover ==========================================================
   One frame of movement, in whichever world the player is currently in.

   The transition is handled HERE rather than inside either collision function,
   because neither of them can see the other. movePlayerShaft() knows about the
   car and nothing else; movePlayerCave() knows about the floor profile and
   nothing else. Neither can tell that the room has arrived, and putting that
   knowledge in either would be exactly the coupling the split exists to avoid.

   `inCave` is sticky within a frame but re-read every frame, so scrolling back
   up walks the player out again. Both directions go through the same pair of
   calls, so the two worlds can never each decide they own the player. */
function movePlayer(dt) {
  var active = caveActive();
  /* The floor has to be FINITE before the handover is allowed. caveActive() is
     true whenever the room is on screen, including the window where the room has
     been measured but its box is degenerate - and enterCave() then reads NaN out
     of screenFloorY() and writes it into player.y, from which every later frame
     draws NaN. The stub's zero-height .treasure box is enough to trigger it, and
     the symptom (a silently missing lantern pool) points nowhere near the cause.

     So the cave is only entered when its floor is actually a number. Staying in
     the shaft for a frame costs nothing and cannot strand the player, because
     movePlayerShaft() re-seats them on the car every frame anyway. */
  if (active && isFinite(screenFloorY(player.x + player.w / 2))) {
    if (!player.inCave) { enterCave(player); player.inCave = true; }
  } else if (!active && player.inCave) {
    leaveCave(player);
    player.inCave = false;
  }

  if (player.inCave) movePlayerCave(dt, player);
  else movePlayerShaft(dt, player);
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
  movePlayerShaft,
  movePlayerCave,
  caveCeiling,
  snapPlayerToGround
};
