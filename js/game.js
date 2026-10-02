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
/* The four per-layer side rooms (ore gallery, stone chamber, deep cave, bedrock
   gallery). A separate world from the bottom cave, for the reason rooms.js
   gives in its header: cave.js owns one room and its tests must keep meaning
   what they meant. */
/* The cage standing at the foot of the shaft: one more solid surface inside the
   room, and the only one that is not part of the floor profile. */
import { cageActive, cageFloorY, overCage } from './cage.js';
/* Physics constants, in CSS pixels and seconds. */
var WALK_SPEED = 95;    /* px/s    */
var GRAVITY    = 2400;  /* px/s^2  */
var JUMP_V     = 540;   /* px/s, negative = upward */

var player = {
  x: 0, y: 0, w: SPRITE_W, h: SPRITE_H,
  vx: 0, vy: 0, facing: 1, onGround: true,
  /* Whether the player is in the bottom cave - the one room they are genuinely
     INSIDE, at the end of the dig, reached by riding the car all the way down.
     Read by movePlayer() to pick the collision function, and by the renderer to
     decide whether the car is still worth drawing.

     There is deliberately NO side-room flag. The four galleries used to have
     `inRoom`, set by a handover that wrote the player's position directly - the
     teleport. They are scenery now, at fixed document positions, and nothing
     about being near one changes where the player is. See the note in
     movePlayer() for the whole of it.

     Starts false, because the page opens at the top where there is no cave. */
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

/* === The platforms =========================================================
   The cave now has three kinds of surface underfoot: the stone shelves the reader
   climbs, the lift cage at the foot of the shaft, and the cave floor itself. This
   function resolves ALL THREE at once and takes the highest, rather than testing
   them in sequence.

   Sequencing is the obvious way to write this and it is wrong: whichever surface is
   tested first claims the frame, so a player standing on a shelf can be resolved
   onto the floor instead - and their feet are below the floor line too, so the
   floor pulls them straight down through the shelf. With one platform that never
   came up; with three it is a live bug every time two of them overlap in x.
   Asking all three and taking the minimum Y removes the ordering question.

   THE ONE-WAY PROPERTY, which is shared by all of them: a player descending onto
   a surface lands on it, a player already resting on one is held there, and a
   player walking in from the side passes UNDERNEATH. None of them adds any
   horizontal collision - they are open rock and an open steel frame, not walls -
   which is what keeps the reader able to cross the cave along its floor.

   Gravity runs BEFORE this function, which is why the resting case needs a
   tolerance at all: a player standing on a surface arrives every frame already a
   fraction of a pixel BELOW it. Without `slip` they drop through at 40px/s, which
   is precisely the bug the first version of the cage had. */
function movePlayerCage(dt, player) {
  var slip = GRAVITY * dt * dt + 1;
  var cx = player.x + player.w / 2;

  /* A RISING player is caught by nothing: a jump taken from under a shelf, or
     from inside the cage, passes up through both. That is the whole one-way
     property, and it is a property of the DIRECTION of travel rather than of the
     height.

     The first version of this guard was `vy < 0 && feet < plate - slip`, which
     tried to let a player through only once they were clearly below. That is the
     wrong shape entirely, and the jump test caught it: the rise is 44px and the
     jump apex is 60.75px, so a player rising from the floor arrives within a
     pixel or two of the plate - inside `slip` - was caught by it, slammed back
     down, and could never get on the cage at all. */
  if (player.vy < 0) return false;

  /* `slip` is the resting tolerance, and it is what makes standing work at all.
     Gravity is applied before this function runs, so a player already standing
     arrives a fraction of a pixel BELOW the surface - about 0.67px at 60fps, and
     proportionally more at a lower frame rate. A plain `feet <= surface` test
     hands them to the cave floor and drops them through at 40px/s, which is
     exactly the bug the first version of the cage had. Derived from GRAVITY and
     dt rather than a fixed pixel count, because a fixed one is silently wrong at
     another frame rate. */

  /* ALL THREE SURFACES ASKED AT ONCE, and the HIGHEST wins. The cave now has
     three kinds of platform in it - the shelves, the cage, and the floor - and
     testing them in sequence lets whichever runs first claim the frame. The
     failure is silent and nasty: a player resolved onto the floor while standing
     on a shelf gets pulled down through it, because their feet are below the
     floor line as well.

     Asking all three and taking the minimum Y removes the ordering question
     entirely. A shelf beats the cage beats the floor, because each is by
     definition above the next. */
  var surface = null;
  /* The cage's plate is a candidate ONLY where the player is actually over it.
     This guard was dropped during an earlier rewrite and the platform suite caught
     it at once: cageFloorY() returns the plate's Y for ANY x, so an ungated plate
     claims the player across the entire cave. One missing predicate, and every
     surface above the plate stopped being reachable. */
  var plate = (cageActive() && overCage(cx)) ? cageFloorY() : NaN;
  var floorY = screenFloorY(cx);

  /* TWO surfaces now, not three: the lift cage and the cave floor. The eight
     stone shelves are gone - the cave reads better as one walkable floor with the
     cage standing on it, and the shelves were what made the room feel like a
     platformer rather than a cave. Asking both and taking the minimum Y keeps the
     ordering question closed. */
  if (isFinite(plate)) surface = plate;
  /* The floor is a candidate only when the player's feet are actually at or
     above it. That guard is what stops this claiming someone standing on the
     cage: their feet are above the floor line, but the cage is the surface they
     actually mean. */
  if (isFinite(floorY) && player.y + player.h <= floorY + slip) {
    if (surface === null || floorY < surface) surface = floorY;
  }
  if (surface === null) return null;    /* mid-air over nothing: fall */

  /* At or above it, or already resting on it: land, or hold. Either way this
     surface is the ground for the frame, and the caller must not run a second
     floor resolve against it. vy is zeroed so the next frame's gravity starts from
     rest rather than compounding. */
  if (player.y + player.h <= surface + slip) {
    player.y = surface - player.h;
    player.vy = 0;
    player.onGround = true;
    return surface;
  }
  /* Genuinely underneath one of them - walked in below the cage, or under a
     shelf. The floor owns them, and they must NOT be lifted. Returning the
     surface rather than null is deliberate: the caller applies the step-up rule
     against it, and the floor resolve has to be able to see where the rock is.

     This branch is what makes every platform in the room one-way. */
  return surface;
}


function movePlayerCave(dt, player) {
  var b = caveBounds();

  /* --- horizontal: integrate, then the cave walls --- */
  player.x += player.vx * dt;
  if (player.x < b.left) { player.x = b.left; player.vx = 0; }
  if (player.x > b.right - player.w) { player.x = b.right - player.w; player.vx = 0; }

  /* --- vertical: gravity, then the floor --- */
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;

  /* Every vertical surface in the cave is resolved in ONE place, one line below,
     and the value it returns is the surface the player is against - a number, or
     null for "nothing underfoot". This function does not sample the floor a
     second time: it used to, and having two samples of one curve is exactly the
     drift this codebase keeps paying for. It was worse than redundant, because
     the second sample sat behind a branch that a settled player never reached -
     so a mutation of that line survived every check in the suite while the floor
     it sampled was never used.

     What lives here instead is the step-up rule, which needs the surface but not
     the sampling: climbing something too steep to jump reads as hitting an
     invisible wall, which is what it is, and beats teleporting up a slope. */
  var surface = movePlayerCage(dt, player);

  if (surface !== null && player.y + player.h >= surface) {
    var rise = surface - (player.y + player.h);
    /* Climbing something too steep to jump reads as hitting an invisible wall,
       which is what it is, and beats teleporting up a slope. */
    if (player.vy > 0 && rise > CAVE_STEP && !player.onGround) {
      player.vy = 0;
    } else {
      player.y = surface - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  } else if (surface === null) {
    player.onGround = false;      /* airborne over nothing */
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
  /* THE SIDE ROOMS ARE NOT HERE, AND THAT IS THE FIX.

     There used to be a side-room handover in this function: settledRoom() waited
     for the reader to stop scrolling near a room, and then enterRoom() WROTE
     player.x and player.y to put them in it. That was the teleport the reader
     kept reporting - "it teleports the player when it's near it" - and it was
     not a bug in the teleport, it was the teleport working exactly as written.

     A room that is merely NEAR the reader must never move them. Proximity is not
     consent. So the whole handover is gone: the four rooms are now scenery at
     fixed document positions, painted because their cell is on screen, exactly
     like the Skills, Experience, Education and Projects panels beside them. The
     player rides the car and walks the shaft, and nothing on the page can pick
     them up and put them somewhere they did not walk to.

     What this deliberately does NOT do is let them walk into the rooms. There is
     no path from the shaft into a gallery yet, and building one properly - a
     continuous floor and doorways in the shaft wall - is the next piece of work.
     An earlier attempt at that is described at the bottom of this file; it was
     reverted because it introduced a car-floor regression that could not be
     pinned down. Doing it in the right order is the job now, and it is a much
     smaller job with the teleport already out of the way: there is no handover
     left to accidentally resurrect.

     The bottom cave keeps its own handover, below. It is genuinely a room you
     are inside at the END of the document, reached by riding the car all the way
     down, and it is the one place the player is still placed rather than walked. */
  var active = caveActive();

  /* The floor has to be FINITE before either handover is allowed. caveActive()
     is true whenever the room is on screen, including the window where the room
     has been measured but its box is degenerate - and enterCave() then reads NaN
     out of screenFloorY() and writes it into player.y, from which every later
     frame draws NaN. The stub's zero-height .treasure box is enough to trigger
     it, and the symptom (a silently missing lantern pool) points nowhere near
     the cause.

     So the cave is only entered when its floor is actually a number. Staying in
     the shaft for a frame costs nothing and cannot strand the player, because
     movePlayerShaft() re-seats them on the car every frame anyway. The same
     guard is applied to the side rooms, for the same reason and with the same
     consequence: rooms.js already refuses to measure a zero-area cell, but the
     guard is about the FLOOR being a number rather than about the box existing,
     and the two are not the same condition. */
  if (active && isFinite(screenFloorY(player.x + player.w / 2))) {
    if (!player.inCave) { enterCave(player); player.inCave = true; }
  } else if (!active && player.inCave) {
    leaveCave(player);
    player.inCave = false;
  }

  /* Dispatch. Shaft is the fallback for every state that is not the cave. */
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
  movePlayerCage,
  caveCeiling,
  snapPlayerToGround
};
