/* ==========================================================================
   cave.js - the explorable bedrock cave at the foot of the dig
   ==========================================================================
   The treasure room is where the shaft ends, and until now it was a wall: the
   car stopped a viewport above it and the player could walk nowhere. This module
   is the room the reader actually walks into.

   WHY THE GEOMETRY IS IN DOCUMENT SPACE, WHICH IS THE WHOLE DESIGN
   ------------------------------------------------------------------
   The canvas is position:fixed and the rooms are ordinary scrolling HTML. So
   anything the canvas draws in SCREEN space slides against the HTML underneath
   it the moment the reader scrolls, and pixel-aligning the two is the known
   fragile spot in this repo (see the note on scrollY in pixel-probe.html, where
   a destructured copy of scrollY read a permanent 0).

   So the cave's floor profile is a function of WORLD x - a fixed shape, in the
   same document space as layers[] - and only the final conversion to screen
   space subtracts scrollY, once, in one place. The chests stay real HTML
   positioned by the ordinary flow, and the cave is drawn in the same coordinates
   they already occupy. They cannot drift apart, because nothing in here has an
   opinion about where the chests are: it reads their measured boxes.

   THE PLAYER STAYS IN SCREEN SPACE. This is deliberate. game.js compares the
   player's y against groundY(), which is a screen-space number from deck.js,
   and quietly switching coordinate spaces mid-module is how the two start
   disagreeing about where the floor is. So the cave answers a screen-space
   question - caveFloorY(x) - and the player is placed on it directly, rather
   than the player living in world space and being converted on the way out.

   THE CAVE IS ONLY REAL WHEN THE ROOM IS ON SCREEN. caveActive() is the gate on
   every other function here. Above it the shaft still owns the player; below it
   the room does. Nothing in this module moves the player between the two - see
   enterCave()/leaveCave(), which are called from the frame loop and do it
   explicitly, so the handover is one readable transition rather than a rule
   buried in a collision test.
   ========================================================================== */

/* World-space profile of the cave floor, sampled on a fixed step. Rebuilt only
   when the viewport width changes, because it is a function of x and nothing
   else - it must NOT be reseeded per frame or the floor would boil. */
var FLOOR_STEP = 16;
/* The floor's flat datum, in world y. Everything else is a rise above this. */
var FLOOR_BASE = 0;
/* How far the floor may rise or fall from the datum, in px. Enough to read as a
   cave floor with rubble on it, shallow enough that the player never has to
   climb a wall they cannot jump (JUMP_V^2 / 2*GRAVITY is 60.75px). */
var FLOOR_RELIEF = 22;
var floor = [];          /* world x -> world y, one entry per FLOOR_STEP */
var floorW = -1;         /* width the profile was built for */
var room = null;         /* measured room box, in document space */

/* Seeded, so the cave is the same cave on every reload - the reader should not
   have to learn a new floor each visit, and a random one would move under them
   mid-walk. Fixed seed rather than a clock, for the same reason the props pass
   uses one. */
var CAVE_SEED = 0x0CA7E;

/* Inset from the viewport edge, so the reader cannot walk off the side of the
   screen into nothing. Wide enough that the player sprite (64px) never gets
   wedged against it, which is what a margin narrower than the sprite would do. */
var CAVE_MARGIN = 34;
/* CAVE_REACH is GONE. It was how close the player had to be to a chest for it
   to be "the one they are at" - the reach used by chestAnchors()/
   nearestChest() below, both of which existed only to serve treasure.js. With
   the hoard removed there is nothing in the room to be near, and a proximity
   test with no target is not a smaller thing to keep than a whole one; it is
   the same dead code at a smaller size. */
/* Nominal height of the cave above its floor, at a normal viewport. Lives here
   rather than in game.js because BOTH need it - the collision clamps the head
   against it and the renderer places the void behind the rock - and a ceiling the
   renderer had to guess at would not be the ceiling the player bumps into.

   Generous, because a jump peaks at JUMP_V^2 / (2 * GRAVITY) = 60.75px. A roof
   much closer than that than the jump apex turns the jump into a visible no-op.

   CLAMPED TO THE VIEWPORT at use. It was a bare 300 and the smoke suite caught it
   at 300x200: the room's own top is 60px down in that viewport, so a 300px cave
   puts the roof 240px ABOVE the fold, the ceiling clamp fires, and the player is
   reported as having left the screen. The cave cannot be taller than the window
   it is drawn in. */
var CAVE_HEIGHT = 340;

/* The roof, in screen space: the floor minus the cave height, never off the top
   of the frame. One function so the collision and the renderer cannot pick
   different ceilings. */
function caveRoof() {
  var h = viewH || 0;
  var floor = screenFloorY(0);
  var want = CAVE_HEIGHT;
  /* The cave must fit INSIDE the frame, and there are two things that has to
     leave room for: the roof must not go above y=0, and the floor must not sit so
     high that the player's head is already off the top when they stand on it.

     A single height clamp gets the first and not the second, which is why this
     failed at 300x200 twice. Clamping the height to `viewH - CAVE_SPRITE_MIN`
     still left a 96px cave whose floor was 60px down, putting the roof at -76 and
     the player's head off screen - the check reported "left the screen" and the
     cause was the ROOF, not the floor.

     So the ceiling is derived from the floor directly: never above the top of
     the frame, and never so high that standing on the floor puts the player's head
     above it. The second term is what actually fixes the small viewport. */
  /* The roof is the floor minus the cave height. The height is bounded by
     maxByHead - how tall a cave can be before the player's head is above the frame
     when they stand on this floor - which is the bound that matters, because it
     is derived from the floor rather than from the viewport.

     There was a second, viewport-derived clamp here as well (`viewH - CAVE_SPRITE_MIN`
     and a `floor < 40` special case) and it has been removed. Both faults that
     removed either one - mutation 47 - SURVIVED, which is the useful part: the two
     clamps produced the same answer at every viewport the suite renders, so no
     check could tell them apart, and a test that cannot tell two implementations
     apart is measuring neither of them. One bound, derived from the thing that
     actually constrains it, is both shorter and checkable. */
  if (h > 0) {
    var maxByHead = floor - CAVE_SPRITE_MIN - 1;
    if (maxByHead < 0) maxByHead = 0;
    want = Math.min(want, maxByHead);
    /* Floor of one pixel, so the ceiling clamp always has something to clamp
       against - a cave exactly as tall as its floor would pin the player to it. */
    if (want < 1) want = 1;
  }
  return floor - want;
}

/* NOTE, no constant: the floor's park line used to be `viewH * CAVE_FLOOR_PARK` and
   is caveFloorParkY() now. A fraction of the viewport could not satisfy the two
   constraints that actually govern it - the floor must be low enough that the
   player stands on it inside the frame at EVERY viewport (300x200 included), and
   low enough that the room reads as a cave rather than a strip along the bottom.

   Both directions of that were tried and both were wrong in a way that left the
   suite green. 0.72 put the park line at 648px while the cave's whole active range
   is 0-450px, so the floor was clamped flat for its entire life - a corridor with
   a straight line down it, which is the exact thing this feature exists to avoid.
   0.30 got that right and failed at 300x200, where a third of a 200px viewport is
   60px and the player is 64px tall. */
function caveRnd(seed) {
  var s = seed;
  return function () {
    s = s + 0x6D2B79F5 | 0;
    var t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* Value noise on the floor, so it undulates instead of stepping. Two octaves:
   the coarse one gives the cave its bays and shelves, the fine one breaks up
   the regularity that a single sine would give away immediately. */
function caveProfile(x, w) {
  var coarse = Math.sin(x / w * Math.PI * 2.1 + 0.7) * 0.6
             + Math.sin(x / w * Math.PI * 5.3 + 2.1) * 0.4;
  var fine = Math.sin(x / 19 + 1.3) * 0.5 + Math.sin(x / 7 + 0.4) * 0.5;
  return (coarse * 0.72 + fine * 0.28);
}

/* Build the floor profile for a viewport `w` wide. Called from measure(), not
   per frame: the profile is world-space, so rebuilding it at a different width
   is the only thing that legitimately changes it. */
function buildFloor(w) {
  if (!(w > 0)) { floor = []; floorW = -1; return; }
  if (w === floorW && floor.length) return;   /* unchanged: keep the cave */
  floor = [];
  for (var x = 0; x <= w + FLOOR_STEP; x += FLOOR_STEP) {
    floor.push(FLOOR_BASE - caveProfile(x, w) * FLOOR_RELIEF);
  }
  floorW = w;
}

/* Sample the floor, interpolating between the built steps. Linear, because the
   renderer draws straight segments between the same samples - the collision and
   the art are reading one curve, so they cannot disagree about the shape. */
function floorAt(worldX) {
  if (!floor.length) return FLOOR_BASE;
  var i = worldX / FLOOR_STEP;
  var i0 = Math.floor(i);
  if (i0 < 0) i0 = 0;
  if (i0 >= floor.length - 1) i0 = floor.length - 2;
  if (i0 < 0) return floor[floor.length - 1];
  var f = i - i0;
  return floor[i0] + (floor[i0 + 1] - floor[i0]) * f;
}

/* === Measuring the room ====================================================
   Called from layers.js measure(), alongside every other re-measure, so the
   cave is positioned by the same event that positions the bands. Reading the
   DOM from here and nowhere else is what stops the cave and the room disagreeing
   about where the room is.

   Only the box is stored, and it is stored in DOCUMENT space. The screen-space
   conversion happens in screenFloorY() below, every frame, from the live
   scrollY - a stored screen y would be stale the moment the reader scrolled,
   which is the exact bug this module's header describes. */
function measureCave(w, h) {
  setViewSize(w, h);
  buildFloor(w);
  /* The cave is anchored to `.dig`, the grid that holds every row - it is a real
     element that is always present, so this cannot half-measure the way an
     optional room element could.

     It used to measure `.treasure` (an empty <section> that existed only to be
     measured, carrying no content). That is gone from the markup: an element
     whose only purpose was to give the cave a box to read is a worse
     arrangement than reading the container that already exists.

     THE ROOM'S TOP IS NOT THE DIG'S TOP. `.dig` spans the whole dig, so using
     its top would put the cave's ceiling behind the surface camp and hand the
     player over at the very first scroll. The cave is the run of page BELOW the
     last chamber, so the top is the Education chamber's bottom. That is the one
     number that says "the dig is over".

     Room height is therefore the remainder of the dig, which is what the cave
     has always been: the rock under the deepest chamber. It is at least one
     pixel, because a zero-height room is treated as unmeasured below, and the
     stub reports a zero-height box for a section that has not laid out. */
  /* THE ROOM'S TOP IS THE CAVE SECTION'S BOTTOM. It used to be the Education
     chamber's bottom, because the cave had no section of its own - it was the
     airspace below the dig. Now it is a real room with a panel, so the cavern
     the player walks in starts below THAT panel rather than below Education.

     Both the car and the cave must agree on this edge or the sprite would be
     handed to a cave whose ceiling is somewhere behind its own room. */
  var dig = document.querySelector('.dig');
  if (!dig) { room = null; return null; }
  var dr = dig.getBoundingClientRect();
  if (!dr || !(dr.height > 0)) { room = null; return null; }

  var digTop = Math.round(dr.top + (window.scrollY || 0));
  var digBottom = Math.round(dr.bottom + (window.scrollY || 0));
  var last = document.querySelector('#cave');
  var top = digTop;
  if (last) {
    var lr = last.getBoundingClientRect();
    if (lr && lr.height > 0) top = Math.round(lr.bottom + (window.scrollY || 0));
  }
  /* Never above the dig, and never past its floor. A last chamber taller than
     the dig would otherwise invert the room and hand back a negative height. */
  if (top < digTop) top = digTop;
  if (top > digBottom) top = digBottom;

  room = {
    el: dig,
    top: top,
    bottom: digBottom,
    left: Math.round(dr.left),
    width: Math.round(dr.width)
  };
  return room;
}

/* Is the room on screen? THE GATE.

   A room that has been measured but is still below the fold is not somewhere the
   player can be: they are in the shaft, and the shaft owns them. So every other
   function here is only meaningful once this is true, and the frame loop asks it
   before it moves the player anywhere.

   The test is "the room's top has reached the upper half of the viewport", not
   "the room is visible". Visible means the reader can see a sliver of it, and at
   that point the car is still legitimately in the shaft with the player on it;
   handing over on the first sliver would rip the player off the car while the
   shaft was still the thing on screen.

   The threshold is viewH, not window.innerHeight: the stub leaves the latter
   undefined, and `top - undefined < undefined * 0.5` is a comparison against NaN,
   which is always false - so the cave would have reported itself inactive at
   every scroll position and none of this would ever have been exercised. */
function caveActive() {
  if (!room) return false;
  var h = viewH || 0;
  if (!(h > 0)) return false;
  return room.top - (window.scrollY || 0) < h * 0.5;
}

  /* THE FLOOR ITSELF CAN BE TOO HIGH, and that is a floor problem rather than a
     roof one. At 300x200 the room's top parks at 60px and the player is 64px tall,
     so standing on that floor puts their head 4px above the frame - "left the
     screen" again, this time with the roof already fixed and the floor to blame.

     So the park line has a second, absolute constraint: the floor can never come
     above the sprite's own height. Below that there is simply nowhere to stand,
     and the room has to stay out of the way of its own occupant. */
function caveFloorParkY() {
  var h = viewH || 0;
  if (!(h > 0)) return 0;
  /* The floor is not one line - it undulates by up to FLOOR_RELIEF. Clamping on
     the datum alone leaves the HIGHEST point of the profile above the sprite,
     which is the last two frames of the 300x200 failure: y came back as +4 with
     the datum already parked at 68. So the park line is raised by the full relief
     and every column of the floor is then guaranteed to sit below it. */
  var min = CAVE_SPRITE_MIN + 2 + FLOOR_RELIEF;
  /* Never lower than a third of the frame either: past that the room is a strip
     along the bottom with no sky above it to read as a cave. */
  var third = h * 0.34;
  return Math.max(third, min);
}

/* Screen-space y of the cave floor at a screen x. The ONE place world becomes
   screen, which is the point: every other function here works in world space and
   never has to think about the scroll.

   CLAMPED TO THE VIEWPORT, and this is the one piece of the cave that does not
   track the room exactly. The room's top keeps rising as the reader scrolls, so
   an unclamped floor walks up the screen and eventually off the top of it - which
   is what the smoke suite reported as "the character left the screen" at five
   viewports. The player stands on this line, so once it is above the frame there
   is nowhere for them to be.

   The clamp is a FLOOR on the screen y, not a ceiling on the scroll: the floor
   descends with the room until it reaches the park line and then stops, which is
   the same trick the lift plays (a document-space stop rather than a per-frame
   cap, because a cap that tightens as you scroll reverses direction). The chests
   above it are still HTML in the ordinary flow, so they keep their own positions;
   what the clamp buys is that the floor stays somewhere a reader can stand on
   while they do.

   Returns NaN for an unmeasured cave rather than dereferencing a null room. That
   is deliberate: the stub reports a zero-height .treasure box during part of the
   smoke run, and reading r.top off null threw there. NaN is not a nice value to
   hand a renderer, but the canvas is DESIGNED not to complain about it - a
   fillRect(NaN, ...) is silently dropped - and the stub context, which reports
   every non-finite argument, turns that silence into a named test failure. A
   missing room is a real fault and should read as one. */
function screenFloorY(screenX) {
  if (!room) return NaN;
  var y = floorAt(screenX) + room.top - (window.scrollY || 0);
  var park = caveFloorParkY();
  /* CLAMPED TO THE PARK LINE. This clamp used to be here and was dropped in a
     rewrite, so `park` was computed and then thrown away - the function computed
     a floor line it had no intention of using.

     Without it the floor's screen y is driven entirely by the room's document top
     minus the scroll, so on a window shorter than the sprite the floor rises above
     the top of the frame and the player is drawn at a negative y: the smoke suite
     reported y=-13.9 in a 200px window and y=-23.9 in a 150px one.

     It bites hardest on short viewports because the park line's two terms - a
     third of the frame, and the sprite plus the floor's relief - are both floors
     on how high the floor may sit, and the un-clamped value is free to go above
     both. Restored rather than re-derived: caveFloorParkY() already documents
     exactly what the clamp has to guarantee, and a second clamp here would be a
     second answer to the same question. */
  if (isFinite(park) && y < park) y = park;
  return y;
}

/* The cave's left and right walls, in screen space. The room is full width, so
   these are the viewport edges inset by a margin - the reader cannot walk off
   the side of the screen into nothing. */
function caveBounds() {
  var m = CAVE_MARGIN;
  /* viewW, set by measureCave() from the same re-measure that sizes the canvas -
     which is why it is the FIRST choice and window.innerWidth is not used at all.

     That is not tidiness. The smoke stub leaves window.innerWidth undefined for
     the whole run, so `window.innerWidth || 0` collapsed every cave to a 34..99px
     slot: the player was pinned against the left wall at x=35 with nowhere to
     walk, while the floor and the art (which read viewW) spanned the full 1920.
     viewW is the number the canvas was actually sized from, so it is the number
     the cave's walls must agree with. */
  var w = viewW || 0;
  var right = w > 0 ? Math.max(m + 1, w - m) : m + 1 + CAVE_SPRITE_MIN;
  return { left: m, right: right };
}

/* chestAnchors() and nearestChest() are GONE, and CAVE_REACH with them.

   Both existed for one consumer: treasure.js, to find the chest the player was
   standing at so it could highlight that one and open it on approach. They read
   the chests' measured boxes rather than caching positions, which was the right
   call while the chests were real HTML that reflowed - but with the hoard
   removed there is nothing to measure and no consumer left. The room is empty,
   and the walk across it is now bounded only by caveBounds().

   Note what this does NOT remove: cave.js is still the module that measures the
   room, builds the floor profile and answers where the floor is. The cave is
   very much still here; only the furniture that stood in it has gone. */

/* === Entering and leaving ===================================================
   The handover is explicit and lives here, rather than being implied by the
   collision test noticing a different floor. Two reasons.

   First, a player who is somewhere else cannot simply be teleported: if the
   reader scrolls fast, the room can arrive with the player still halfway up the
   shaft, and dropping them from the ceiling looks like a glitch. So the entrance
   puts them on the floor from above, at the shaft's own x, and lets gravity do
   the last few pixels.

   Second, and more importantly, going the OTHER way has to be handled. Scroll the
   reader back up and the cave stops being active - but the player is standing on
   the cave floor at the far left of the screen, with no car under them. Leaving
   is not a transition the frame loop can infer; it has to be asked for. */
function enterCave(player) {
  if (!caveActive()) return false;
  /* Drop in from just above the floor rather than through it. The offset is the
     sprite height, so they arrive standing. */
  player.x = Math.max(caveBounds().left,
              Math.min(player.x, caveBounds().right - player.w));
  player.y = screenFloorY(player.x + player.w / 2) - player.h - 8;
  player.vx = 0;
  player.vy = 0;
  return true;
}

function leaveCave(player) {
  /* Hand the player back to the shaft, at the MIDDLE OF THE VIEWPORT - which is
     where the shaft column is on a desktop layout. viewW rather than
     window.innerWidth: the smoke stub leaves the latter undefined, so using it
     here put the returning player at NaN. cave.js cannot import shaftMid()
     without becoming part of the layers <- game chain, and the centre is the one
     answer that is correct for both layouts anyway (on a phone the shaft is a
     strip on the left edge, and movePlayerShaft() clamps the player into it on
     the very next call). */
  player.x = Math.round(viewW / 2 - player.w / 2);
  if (!isFinite(player.x)) player.x = 0;
  player.vx = 0;
  player.vy = 0;
  return true;
}

/* Public surface. Collected in one block at the bottom like every other module
   here, so smoke.mjs's graph check can read it. cave.js is a LEAF in the sense
   that matters: it imports nothing, so it can sit anywhere in the graph. */
/* --- Drawing constants, exported because render.js draws the cave ------------
   These live here rather than in render.js on purpose. The rubble and the ore
   are placed at the FLOOR'S OWN steps, so they have to know the step size, and
   a second copy of that number in the renderer is how the art and the collision
   drift apart - the meadow's twitch all over again, with rubble on it.

   Also exported: caveRnd(), because the rubble must be the SAME rubble on every
   frame. Seeding it inside the draw loop looks harmless and is not: a fresh seed
   per frame makes the rocks boil. */
var CAVE_RUBBLE_SEED = 0x0CA7E + 11;
var CAVE_VEIN_SEED = 0x0CA7E + 29;
/* Aliased rather than exported as `FLOOR_STEP as ...`, which is not JavaScript:
   the `as` form belongs to TypeScript. The alias exists purely so render.js can
   say CAVE_FLOOR_STEP and be unambiguous about which step it is sampling. */
var CAVE_FLOOR_STEP = FLOOR_STEP;

/* The viewport width, read off the window rather than imported from layers.js.
   Importing viewW would be more direct, but cave.js is deliberately a module
   that imports NOTHING: it is pulled into layers.js (which calls measureCave),
   into game.js and into render.js, and a leaf is the one shape that cannot close
   a cycle. window.innerWidth is the same number by the time this runs, and the
   smoke harness's stub keeps them in step - which is why viewW is only a
   fallback here and not the other way round. */
var CAVE_SPRITE_MIN = 64;   /* the player sprite's width, from avatar.js */
var viewW = 0;

/* Height of the viewport, cached the same way as the width. Needed here for the
   same reason: window.innerHeight is undefined under the smoke stub, and
   `undefined * 0.5` is NaN, so a comparison against NaN is false and the cave
   would report itself inactive no matter where the reader had scrolled to. */
var viewH = 0;

function setViewSize(w, h) {
  if (w > 0) viewW = w;
  if (h > 0) viewH = h;
}

/* The room's top in DOCUMENT space, exposed so a check can rebuild the drawn
   floor from the profile and the scroll alone. Reading it from here rather than
   from screenFloorY() is what keeps the floor-agreement assertion independent of
   the function it is testing. */
function caveRoomTop() {
  return room ? room.top : NaN;
}

export {
  CAVE_MARGIN,
  CAVE_HEIGHT,
  CAVE_FLOOR_STEP,
  CAVE_RUBBLE_SEED,
  CAVE_VEIN_SEED,
  caveRnd,
  measureCave,
  caveRoomTop,
  caveActive,
  caveBounds,
  caveRoof,
  screenFloorY,
  floorAt,
  enterCave,
  leaveCave
};