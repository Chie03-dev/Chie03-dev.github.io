/* ==========================================================================
   game.js - the simulation: player, collision and input
   ==========================================================================
   The part a visitor actually plays. Owns the player object, the physics
   constants, the height-field collision resolve, the keyboard handlers and
   the jump.

   Deliberately holds no drawing code and never touches the 2d context.
   That restraint is what keeps the modules a one-way chain rather than a
   tangle of imports.
   ========================================================================== */

import {
  clamp, shaftLeft, shaftRight, shaftMid, groundY, SPRITE_W, SPRITE_H
} from './layers.js';

/* Physics constants, in CSS pixels and seconds. */
var WALK_SPEED = 95;    /* px/s    */
var GRAVITY    = 2400;  /* px/s^2  */
var JUMP_V     = 540;   /* px/s, negative = upward */
var MAX_STEP   = 14;    /* tallest ledge the player can walk up, px */

var player = {
  x: 0, y: 0, w: SPRITE_W, h: SPRITE_H,
  vx: 0, vy: 0, facing: 1, onGround: true, feetPrev: 0
};
function snapPlayerToGround() {
  var minX = shaftLeft() + 4;
  var maxX = shaftRight() - 4 - player.w;
  if (maxX < minX) { maxX = minX; }          /* shaft narrower than the sprite */
  player.x = clamp(player.x, minX, maxX);
  if (!isFinite(player.x) || player.x === 0) player.x = Math.round(shaftMid() - player.w / 2);
  player.y = groundY(player.x + player.w / 2) - player.h;
  player.feetPrev = player.y + player.h;
  player.vx = player.vy = 0;
}
/* === Collision ===========================================================
   AABB against a height field plus two vertical walls. The ground is a
   function groundY(x) rather than a tile grid, which is the cheapest way to
   get continuous terrain for a starter. Two rules matter:

     1. If the surface is at or just above the feet (within MAX_STEP), the
        player snaps onto it: that's a walkable step.
     2. If the surface rose more than MAX_STEP in one frame, the ledge is a
        wall. We push the player back to where the feet started instead of
        letting them clip into rock, and zero horizontal motion so they do
        not slide up the face of it.
*/
function movePlayer(dt) {
  var minX = shaftLeft() + 4;
  var maxX = shaftRight() - 4 - player.w;
  if (maxX < minX) maxX = minX;         /* shaft narrower than the sprite */
  var startX = player.x;
  var ground, feet, rise, blocked = false;

  /* --- horizontal: integrate, then push out of the shaft walls --- */
  player.x += player.vx * dt;
  if (player.x < minX) { player.x = minX; player.vx = 0; }
  if (player.x > maxX) { player.x = maxX; player.vx = 0; }

  /* --- vertical: apply gravity, then resolve against the ground --- */
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;

  ground = groundY(player.x + player.w / 2);
  feet = player.y + player.h;

  if (feet >= ground) {
    rise = ground - player.feetPrev;         /* how much the surface rose */
    if (player.vy > 0 || rise <= MAX_STEP) {
      player.y = ground - player.h;           /* landed or stepped up */
      player.vy = 0;
      player.onGround = true;
    } else {
      player.y = player.feetPrev - player.h;  /* too tall to step: a wall */
      player.vy = 0;
      player.onGround = false;
      blocked = true;
    }
  } else {
    player.onGround = false;                  /* airborne */
  }

  if (blocked) {
    player.x = startX;                        /* refuse the step, stay put */
    player.vx = 0;
  }
  player.feetPrev = player.y + player.h;
}
/* === 6. Input ============================================================
   Keyboard only, and deliberately narrow: A/D (or arrows) walk, W jumps.
   Arrow keys are NOT captured, so normal page scrolling and every browser
   shortcut keep working. Nothing here scroll-jacks. */
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
