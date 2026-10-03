/* ==========================================================================
   cage.js - the lift cage standing at the foot of the shaft
   ==========================================================================
   A static steel cage at the bottom of the shaft channel, inside the bedrock
   treasure room. It is the thing the mine car would dock with if it ever came
   the whole way down, and it doubles as the room's one piece of vertical
   structure: a raised platform the reader can jump onto and stand on.

   WHY ITS OWN MODULE. cave.js is at 474 lines against the 500 cap, and this is
   a separate piece of world geometry with a separate owner. More importantly it
   is not the cave: the cave's floor is an undulating profile sampled per frame,
   and the cage is ONE flat plate at a known height. Folding it into the cave's
   height field would mean the platform's height varied with x, which is exactly
   the property a landing must not have - a platform that tilts is a ramp.

   WHY IT IMPORTS cave.js AND NOTHING ELSE. cave.js imports nothing, so an edge
   from here into it only adds a second leaf to the graph and cannot close a
   cycle: layers -> cage -> cave, alongside layers -> cave. The shaft's x and
   width are NOT imported - layers.js owns those, and importing them here would
   close layers -> cage -> layers. They are passed in at measure time instead,
   the same way cave.js is handed viewW and viewH.

   THE PLATFORM IS ONE-WAY, AND DELIBERATELY NOT SOLID. The player can land on
   top of it and walk off either end; they can also walk in beneath it, because
   it is an open steel cage standing on the floor, not a wall. That is why this
   adds no horizontal collision at all - see game.js, which is where the one-way
   landing rule lives. A platform that blocked movement would stop the walk
   across the room that smoke.mjs performs, and would read as a bug rather than
   as a cage you step into.
   ========================================================================== */

import { screenFloorY } from './cave.js';

/* How far the cage floor sits ABOVE the cave floor beneath it, in px. It was 44
   and is now 34, to match the shelves: the whole walkable structure in the room
   sits lower, so the cage no longer towers over the shelves beside it.

   Constrained from both sides, and both bounds are load-bearing:
     - above CAVE_STEP (14px in game.js), or the player would walk straight up
       onto it and it would read as a bump in the floor rather than a platform;
     - below the jump apex, JUMP_V^2 / (2 * GRAVITY) = 60.75px, or it could not
       be reached at all and would be scenery.
   34 leaves a clear margin on both sides, and still clears the floor's 22px of
   relief - which it can only do because cageFloorY() samples the HIGHEST rock
   under its span rather than the rock under its centre. That sampling is what
   makes this number a free choice rather than a constraint imposed by the
   terrain. */
var CAGE_RISE = 34;

/* Half the width of the cage floor, as a fraction of the shaft width. The cage
   has to be narrower than the channel it stands in, and narrow enough that the
   64px player can stand well inside it rather than perching on the edge. */
var CAGE_SPAN = 0.42;

var viewW = 0, viewH = 0;
var shaftX = 0, shaftW = 0;
var measured = false;

/* Fed from layers.js measure(), alongside measureCave(). The shaft numbers are
   passed in rather than imported for the reason in the header: layers.js owns
   them, and an import back would close the cycle this module exists partly to
   avoid.

   A zero or missing shaft falls back to a centred band, matching
   measureShaft()'s own fallback in layers.js, so a page where the shaft element
   never laid out still gets a cage in a sensible place instead of a cage of
   width zero. */
function measureCage(w, h, sx, sw) {
  if (w > 0) viewW = w;
  if (h > 0) viewH = h;
  /* Both shaft numbers are taken together or neither is. main.js runs
     measureShaft() AFTER measure(), so on the very first boot these arrive as
     shaftX = 0 with a shaft width of 0 - and 0 is a finite x, so accepting it
     on its own would silently stand the whole cage at the left edge of the
     screen. Requiring a real width means an unmeasured shaft falls through to
     the centred fallback below, which is where the cage belongs anyway. */
  if (sw > 0 && isFinite(sx)) { shaftW = sw; shaftX = sx; }
  else if (!(shaftW > 0)) { shaftW = 220; shaftX = (viewW - shaftW) / 2; }
  measured = true;
  return true;
}

function cageMidX() { return shaftX + shaftW / 2; }

/* The cage's horizontal span, in screen x. */
function cageSpan() {
  var half = shaftW * CAGE_SPAN;
  var mid = cageMidX();
  return { left: mid - half, right: mid + half };
}

/* Is the cage standing at the foot of the shaft right now? The viewport has to
   be measured: before it, a "cage" would be a floating plate at x=0. */
function cageActive() {
  return measured && isFinite(viewH) && viewH > 0;
}
/* Screen Y of the cage's floor plate, or NaN when there is no cage.

   Taken as the HIGHEST point of the cave floor beneath the whole span, minus
   the rise - not the floor at the cage's own centre. The floor undulates by up
   to 22px, so a plate set from the centre value would be buried under the rock
   at whichever end happens to sit higher, and half the platform would be inside
   the wall. Sampling the highest point under the span guarantees the plate
   clears the floor everywhere across it.

   The scan reads screenFloorY(), the same function the collision and the
   renderer both use, so the plate cannot be placed against a different curve
   from the one the player walks on. */
function cageFloorY() {
  if (!cageActive()) return NaN;
  var s = cageSpan();
  var best = Infinity, x, y;
  for (x = s.left; x <= s.right; x += 8) {
    y = screenFloorY(x);
    if (!isFinite(y)) continue;
    if (y < best) best = y;
  }
  if (!isFinite(best)) return NaN;
  var top = best - CAGE_RISE;
  /* Never so high that the player cannot stand on it. A platform the reader's
     head is off the top of the screen for is worse than no platform at all, and
     the short viewports the smoke suite renders (down to 300x200) are exactly
     where a 44px lift off a high floor would do it. One sprite height plus a
     little clearance is the floor: below that there is no standing room. */
  var lowest = 66;          /* the 64px sprite, plus 2px of clearance */
  if (top < lowest) top = lowest;
  return top;
}

/* Is the player's CENTRE over the cage? The player's own x, not their feet or
   either edge: the same rule the cave collision uses to sample the floor, so a
   platform and the floor under it are judged at one place rather than two.
   Sampling at the centre also means a player straddling the edge stands on
   whichever surface they are mostly over, instead of flickering between them
   frame to frame as they walk. */
function overCage(playerCx) {
  if (!cageActive() || !isFinite(playerCx)) return false;
  var s = cageSpan();
  return playerCx >= s.left && playerCx <= s.right;
}

/* Public surface. Collected in one block at the bottom, like every other module
   here, so smoke.mjs's graph check can read it. */
export {
  CAGE_RISE,
  measureCage,
  cageSpan,
  cageActive,
  cageFloorY,
  overCage
};

