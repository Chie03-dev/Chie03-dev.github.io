/* ==========================================================================
   rooms.js - the walkable side rooms, one per layer
   ==========================================================================
   PURPOSE. Four rooms the reader can walk into: an ore gallery at the dirt
   layer, a worked stone chamber, a deep cave, and a bedrock gallery. Each sits
   in the EMPTY half of its grid row - the side opposite that layer's text
   panel - which is why the dig reads as half-empty today.

   WHY A NEW MODULE RATHER THAN A GENERALISED cave.js
   ---------------------------------------------------
   cave.js is a single room with single-room module state: one floor array, one
   room box, one caveActive() gate, and one set of bounds. Four rooms need four
   of each. Generalising it in place would have meant rewriting the module that
   the smoke suite, the cage suite and the pixel probe all drive against the
   bottom cave, and every failure would have been ambiguous between "the new
   rooms are broken" and "the bottom cave regressed".

   So the bottom cave is left completely untouched and still owned by cave.js,
   and this module runs the four new rooms beside it. game.js asks which room
   owns the player and dispatches; nothing in cave.js changed.

   THE VERTICAL GEOMETRY IS THE BOTTOM CAVE'S, ON PURPOSE
   ------------------------------------------------------
   The floor's minimum line, the roof's maxByHead clamp and the sprite's minimum
   headroom are the hardest-won numbers in this repo - each was arrived at by
   fixing a specific reported failure at a specific viewport. None is
   layer-specific, so a side room reuses them and differs in exactly one axis:
   HORIZONTALLY. Its floor sits at the same minimum and its roof is the same
   height above it; only the left and right walls move in to its own column. A
   second set of vertical constants, tuned separately, would be a second answer
   to questions the first set already answers correctly.

   WHY THE ROOMS ARE NOT IN THE SHAFT
   ----------------------------------
   The shaft column is the reader's transport: scrolling drives the car. If a
   side room owned the player while the reader was still scrolling down to it,
   the car would keep descending with nobody aboard. So a room takes the player
   only once the reader has stopped there - see settledRoom(). */

/* Sample step of the floor profile, in px of world x. Same idea as cave.js's
   FLOOR_STEP: the profile is a function of x and nothing else, so it is built
   once per width change and never per frame. Reseeding it per frame would make
   the floor boil under a standing player. */
var ROOM_STEP = 16;
/* How far a side room's floor may rise or fall from its datum. Shallower than
   the bottom cave's 22px on purpose: these are small rooms, read at a glance
   while scrolling past, and a deep profile in a narrow column reads as noise. */
var ROOM_RELIEF = 14;
/* Inset from the room's own column edges, so the player cannot walk out of the
   side of the room into the text panel beside it. */
var ROOM_MARGIN = 10;
/* The sprite's height. The bottom cave calls this CAVE_SPRITE_MIN and it is the
   constraint behind the whole park-line calculation: the floor can never come
   above the top of the sprite, or there is nowhere to stand. Duplicated rather
   than imported because cave.js cannot be imported from here without pulling
   the bottom cave's module state into this one, which is the coupling this
   module exists to avoid. game.js owns the real player height. */
var ROOM_SPRITE_MIN = 64;

/* The four rooms. `layer` selects the palette and the depth-rail entry, so a
   room and its panel cannot drift out of step - the art reads the layer, not a
   hand-picked colour.

   `seed` is per room rather than one shared seed, so no two floors are the same
   profile at the same x. A shared seed would give all four rooms an identical
   shape, which looks like a copy-paste bug even though it is deterministic. */
var DEFS = [
  { id: 'mine',  layer: 'dirt',    sel: '#room-mine',  seed: 0x11117 },
  { id: 'stone', layer: 'stone',   sel: '#room-stone', seed: 0x22223 },
  { id: 'deep',  layer: 'caves',   sel: '#room-deep',  seed: 0x33331 },
  { id: 'bed',   layer: 'bedrock', sel: '#room-bed',   seed: 0x44441 }
];

/* rooms[i].box is the measured cell in DOCUMENT space; .floor is the profile
   sampled across that cell's width. A null entry means "not measurable here" -
   a missing element, or a hidden one, which is what a phone gets. */
var rooms = [];
var viewW = 0;
var viewH = 0;

/* Seeded generator, local to this module so it cannot perturb cave.js's.
   A Math.random() floor would move under a standing player, and the reader would
   have to learn a new cave on every reload. */
function rnd(seed) {
  var s = seed >>> 0;
  return function () {
    /* xorshift32, the same generator cave.js uses. */
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

/* Deterministic floor for one room: a value per ROOM_STEP of world x across
   that room's column. Smooth, so it reads as ground rather than noise. */
function buildFloor(def, box) {
  var out = [];
  var n = Math.max(1, Math.ceil((box.right - box.left) / ROOM_STEP));
  var r = rnd(def.seed);
  /* Two octaves of stepping sine. The second is a third the amplitude of the
     first, so the floor has a long undulation with fine rubble on it, and no
     high-frequency term large enough to make consecutive samples jump by more
     than the step-up rule can climb. */
  var a1 = r() * Math.PI * 2;
  var a2 = r() * Math.PI * 2;
  var k1 = 1 + Math.floor(r() * 2);
  var k2 = 3 + Math.floor(r() * 3);
  for (var i = 0; i <= n; i++) {
    var t = i / n;
    out.push(Math.round(
      (Math.sin(a1 + t * Math.PI * 2 * k1) * 0.72 +
       Math.sin(a2 + t * Math.PI * 2 * k2) * 0.28) * ROOM_RELIEF
    ));
  }
  return out;
}

/* The profile value at a world x, by nearest sample. Clamps to the ends rather
   than returning undefined, so a player standing hard against a wall still has a
   floor - an undefined here would propagate into player.y and NaN the frame. */
function floorAt(i, worldX) {
  var rm = rooms[i];
  if (!rm || !rm.floor || !rm.floor.length) return 0;
  var t = (worldX - rm.box.left) / ROOM_STEP;
  var n = rm.floor.length - 1;
  if (!(n > 0)) return rm.floor[0];
  var k = Math.round(t);
  if (k < 0) k = 0;
  if (k > n) k = n;
  return rm.floor[k];
}


/* === Measuring =============================================================
   Called from layers.js measure() alongside every other re-measure, so the
   rooms are positioned by the same event that positions the bands. The DOM is
   read here and nowhere else.

   A missing or unlaid-out cell leaves that room null rather than producing a
   zero-height box. A room that measured to nothing would be "active" at every
   scroll position, because an empty box passes every visibility test, and the
   player would be dropped into it - the degenerate case the bottom cave guards
   against in game.js.

   This is also what makes a phone work with no special case in the geometry:
   the stylesheet hides .room below 820px, the cell measures to zero, and the
   room is simply absent. The shaft keeps the reader. */
function measureRooms(w, h) {
  viewW = w || viewW;
  viewH = h || viewH;
  for (var i = 0; i < DEFS.length; i++) {
    var def = DEFS[i];
    var el = document.querySelector(def.sel);
    if (!el) { rooms[i] = null; continue; }
    var r = el.getBoundingClientRect();
    if (!r || !(r.width > 0) || !(r.height > 0)) { rooms[i] = null; continue; }
    var sy = window.scrollY || 0;
    var box = {
      top: Math.round(r.top + sy),
      bottom: Math.round(r.bottom + sy),
      left: Math.round(r.left),
      right: Math.round(r.right)
    };
    var prev = rooms[i];
    /* Rebuild the floor only when the column actually changed width. The
       profile is a function of x, so a rebuild on a height-only change would be
       work for nothing - and a scroll-driven re-measure happens constantly. */
    if (!prev || prev.box.left !== box.left || prev.box.right !== box.right) {
      rooms[i] = { id: def.id, layer: def.layer, el: el, box: box, floor: buildFloor(def, box) };
    } else {
      prev.box = box;
      rooms[i] = prev;
    }
  }
  return rooms.length;
}

/* Which room owns the player, or -1 for none.
   This is the gate every other function here sits behind, and it answers "is
   this room genuinely on screen", not "has the reader scrolled this far".

   The lower bound matters as much as the upper one: a room far below the fold
   must not claim the player while the reader is still descending, because the
   car is still in the shaft at that point and the sprite would be standing in a
   room the reader has not reached. The upper bound is what hands them back.

   When two rooms could both qualify - which happens at the seams, and on a
   viewport shorter than a row - the DEEPEST one wins, because it is the one the
   reader is actually looking at. Returning the shallowest would hand the player
   to a room they are leaving. */
function activeRoom() {
  var sy = window.scrollY || 0;
  var h = viewH || 0;
  if (!(h > 0)) return -1;
  var best = -1;
  var bestTop = -Infinity;
  for (var i = 0; i < rooms.length; i++) {
    var rm = rooms[i];
    if (!rm || !rm.box) continue;
    var top = rm.box.top - sy;
    var bot = rm.box.bottom - sy;
    /* "Top has reached the upper half of the viewport", the same test
       caveActive() uses and for the same reason.

       Not "any part of it is visible". That looks harmless and is not: at
       scrollY 0 on a 900px window the first room's cell already pokes into the
       bottom of the frame, because it sits below the surface camp and the
       viewport is taller than the first row. A visible-sliver test therefore
       reports a room as active at the very top of the page, and because the
       reader is not scrolling, the settle timer is perfectly happy - so on load
       the player is lifted off the car at the surface camp and dropped into a
       gallery 600px below the fold. The smoke suite caught exactly that.

       A sliver of a room is also the right thing to ignore on its own terms:
       the reader cannot see what is in it yet. */
    if (bot > 0 && top < h * 0.5 && rm.box.top > bestTop) { best = i; bestTop = rm.box.top; }
  }
  return best;
}

/* EVERY room whose cell intersects the viewport, shallowest first.

   This is a different question from activeRoom(), and the difference is the
   whole point of the last change. activeRoom() answers "which room should OWN
   the player" - one room, and only once the reader has stopped scrolling at it.
   visibleRooms() answers "which rooms are on screen", which is the same question
   the CSS asks about a content panel, and it is why the rooms were popping in
   and out with the character: they were drawn from player.inRoom, so the art
   only existed while somebody was standing in it. Walk away and the room
   vanished; come back and it reappeared.

   A content panel does not behave like that. The Skills, Experience, Education
   and Projects sections are drawn because they are in the document and part of
   the viewport, and they scroll at the document's rate. The rooms now answer
   the same question the same way, so they scroll with the rock beside the panel
   they belong to and are simply there when that part of the page is on screen.

   Returned as a list, shallowest first, because more than one can be visible at
   once on a tall viewport - exactly as two panels can be on screen at once -
   and drawing only one of them would leave the other half of the page bare.

   Drawn in document order rather than by depth so the deeper room paints over
   the shallower one where they overlap, which is the back-to-front order the
   rock itself is stacked in. */
/* === Walking between the shaft and a room =================================
   The teleport used to put the player in a room. This is the other way: they
   walk, and nothing anywhere is capable of moving them but their own input.

   ONE FUNCTION ANSWERS "WHAT IS UNDER THIS X" FOR THE WHOLE WIDTH, and that is
   the whole mechanism. There is no "which room owns the player" question, so
   there is nothing that can decide the player belongs somewhere.

   WHY THE SHAFT IS ASKED FIRST - AND WHY THAT IS THE ENTIRE RISK CONTROL
   -----------------------------------------------------------------------
   surfaceAt() returns the deck for any x strictly inside the shaft walls, so
   for a player in the shaft this function returns exactly what the old
   movePlayerShaft() returned: the same number, from the same source. Every
   elevator test on this page therefore keeps testing the elevator.

   The previous attempt rewrote movePlayer wholesale and produced "character sank
   through the car floor" at three viewports that I could not diagnose. I blamed
   the room columns overlapping the shaft, applied a fix, and the numbers did not
   move. The mistake was changing everything at once and then guessing which
   change did it. So the shaft path is untouched, and the new behaviour is
   reachable only once the player is already outside the shaft.

   THE RAMP. The room floor and the car deck sit at completely different heights -
   the deck follows the scroll, the room floor is fixed in the document - so a
   flat tunnel would be a cliff at one end. The surface eases linearly between
   them across the gap between the two near walls, and the existing step-up rule
   climbs it. Each endpoint is reproduced exactly, so there is no lip at either
   end of the tunnel.

   A STEEP RAMP IS THE KNOWN LIMITATION, stated rather than hidden. If the deck
   and the room floor are a long way apart the ramp may be too steep to climb,
   and the reader simply cannot get out at that depth. That is a far better
   failure than the one being fixed - a room you cannot enter is missing a door,
   where a room you are teleported into is broken physics - and it degrades to
   "walk somewhere else" rather than to anything visibly wrong. */
function surfaceAt(x, deckY) {
  var d = deckY === undefined ? NaN : deckY;

  /* THE SHAFT INTERIOR IS THE DECK, ALWAYS. This is both the risk control above
     and a real correctness rule: at 1100px and below this stylesheet moves the
     shaft to the LEFT EDGE, where the room columns can reach across it. Asking
     the rooms first returned a room floor for x values plainly inside the shaft,
     and the player standing on the car sank through it. */
  if (isFinite(shaftEdgeL) && isFinite(shaftEdgeR)) {
    if (x > shaftEdgeL && x < shaftEdgeR) return { y: d, kind: 'shaft', i: -1 };
  }

  for (var i = 0; i < rooms.length; i++) {
    if (!roomActive(i)) continue;
    var b = bounds(i);
    var side = entranceSide(i);
    var wall = side > 0 ? b.right : b.left;
    var sw = shaftWallOnSide(side);
    if (!isFinite(sw)) continue;
    if (x >= b.left && x <= b.right) {
      return { y: screenFloorY(i, x), kind: 'room', i: i };
    }
    var lo = Math.min(wall, sw);
    var hi = Math.max(wall, sw);
    if (x > lo && x < hi) {
      var roomY = screenFloorY(i, wall);
      if (!isFinite(roomY) || !isFinite(d)) return { y: d, kind: 'tunnel', i: i };
      var t = (x - lo) / (hi - lo);
      return { y: roomY + (d - roomY) * t, kind: 'tunnel', i: i };
    }
  }
  return { y: d, kind: 'shaft', i: -1 };
}

/* The shaft wall nearest a room on the given side. side follows entranceSide():
   +1 means the shaft is to the room's RIGHT, so the wall a reader steps through
   is the shaft's LEFT one. Getting this backwards pointed the tunnel at the far
   edge and made the doorway a hole 200px wide with the ramp in the wrong half. */
var shaftEdgeL = NaN;
var shaftEdgeR = NaN;
function setShaftEdges(left, right) { shaftEdgeL = left; shaftEdgeR = right; }
function shaftWallOnSide(side) { return side > 0 ? shaftEdgeL : shaftEdgeR; }

/* Whether the shaft wall stops the player here, AND at their current height.
   True = solid, false = a doorway and they may pass.

   THE HEIGHT TEST IS NOT OPTIONAL. A doorway is a hole in a wall at ONE DEPTH.
   Deciding it by x alone punches that hole through the shaft wall at every depth
   on the page, so the reader could wander out of the shaft at the top of the
   document where there is only sky.

   THE SPRITE'S WIDTH COUNTS ON BOTH SIDES OF THE HORIZONTAL TEST. The first
   version required a strict overlap inside the tunnel, while the shaft clamp held
   the player 4px short of the wall - so they could never reach the span that
   opened the doorway. Wall solid, therefore cannot enter tunnel, therefore the
   wall stays solid. Neither rule was wrong; they contradicted each other. Letting
   the sprite straddle the wall resolves it.

   deckY is passed in because the ramp runs from the car to the room floor and
   needs both ends. Without it the ramp collapses to the room floor and the
   doorway measures 400px below a player standing on the deck - which the wall
   then correctly reports as solid, forever. */
function shaftWallBlocks(x, w, feetY, deckY) {
  var feet = feetY === undefined ? NaN : feetY;
  var deck = deckY === undefined ? NaN : deckY;
  /* No feet to compare against, so fail closed: the only safe answer to "I do not
     know" is that the rock is solid. */
  if (!isFinite(feet)) return true;
  for (var i = 0; i < rooms.length; i++) {
    if (!roomActive(i)) continue;
    var b = bounds(i);
    var side = entranceSide(i);
    var wall = side > 0 ? b.right : b.left;
    var sw = shaftWallOnSide(side);
    if (!isFinite(sw)) continue;
    var lo = Math.min(wall, sw);
    var hi = Math.max(wall, sw);
    if (!(x + w > lo && x < hi + w)) continue;
    /* THE RAMP IS SAMPLED AT THE PLAYER'S OWN x, CLAMPED INTO THE TUNNEL - not
       at a fixed point.

       Sampling at the shaft wall returns the DECK, because surfaceAt() treats
       the wall itself as shaft, not tunnel. The ramp's value at the wall is
       therefore always the player's own feet height, so the height test passed
       for every room at every depth: the doorway was "open" exactly as long as
       the player's box overlapped a tunnel span horizontally. That is the
       original horizontal-only bug wearing a height test, and it is what sank
       the player through the car floor at 1920x1200.

       Sampling the player's own x asks the question that is actually being asked
       - "am I standing on the ramp here?" - and is true at the right depth and
       false everywhere else. */
    var px = x + w / 2;
    if (px < lo) px = lo;
    if (px > hi) px = hi;
    var tunnelY = surfaceAt(px, deck).y;
    if (!isFinite(tunnelY)) continue;
    if (Math.abs(feet - tunnelY) < ROOM_SPRITE_MIN + 24) return false;
  }
  return true;
}

function visibleRooms() {
  var sy = window.scrollY || 0;
  var h = viewH || 0;
  if (!(h > 0)) return [];
  var out = [];
  for (var i = 0; i < rooms.length; i++) {
    var rm = rooms[i];
    if (!rm || !rm.box) continue;
    var top = rm.box.top - sy;
    var bot = rm.box.bottom - sy;
    /* ANY part of the cell on screen counts - the sliver test, which is exactly
       right here and exactly wrong in activeRoom(). There, a sliver had to be
       ignored because claiming the player from a sliver threw them out of the
       car at the top of the page. Here there is nobody to throw: this is only
       asking whether to paint the room, and a panel 1px on screen is painted. */
    if (bot > 0 && top < h) out.push(i);
  }
  return out;
}

/* Whether an index names a room that actually measured. Every public function
   taking an index starts here, so a stale index - one left over from a
   re-measure that dropped the cell - degrades to "no room" rather than reading a
   null box. */
function roomActive(i) {
  return i >= 0 && i < rooms.length && !!rooms[i];
}

/* The room's layer key, for the palette and the depth rail. Null when there is
   no room, so a caller cannot accidentally tint an absent room. */
function roomLayer(i) { return roomActive(i) ? rooms[i].layer : null; }


/* === Settling ==============================================================
   THE CAR OWNS THE PLAYER WHILE IT IS MOVING, and this is the rule that keeps
   the two features from fighting.

   Without it, a room claims the player the instant its cell touches the screen
   - which is DURING the descent, because the reader scrolls continuously past
   every layer on the way down. The player would be lifted off the car halfway
   between layers, and every check about the car having someone aboard would
   fail at every viewport. That is not hypothetical: adding the rooms to the
   fixture produced "character sank through the car floor on 27 frames" at
   1920x1200, at every size, on the first run.

   So a room is only offered once the reader has STOPPED there. Scrolling
   continuously means no room ever claims anybody, and the car behaves exactly
   as it did before these rooms existed - which is the point. A reader who
   pauses at a layer gets off and can walk.

   SETTLE_FRAMES is a count of frames, not a time, so it is measured in the same
   dt the rest of the game uses and cannot drift against a slow frame rate. At
   the loop's usual 60fps it is about a quarter of a second - long enough that
   a flick-scroll never triggers it, short enough that stopping feels instant
   rather than sticky. */
var SETTLE_FRAMES = 14;
var lastScroll = null;
var stillFrames = 0;

/* Whether a room is on screen AND the reader has stopped scrolling. Returns the
   room index, or -1. This - not activeRoom() - is what game.js must gate the
   handover on; activeRoom() is exported because the tests need to ask the
   purely geometric question without the timing on top of it.

   The scroll is read LIVE every call, never cached across calls, for the same
   reason cave.js re-reads scrollY in screenFloorY(): a stored scroll value is
   the bug this repo keeps paying for, and it is a bug that only shows up while
   moving. */
function settledRoom() {
  var i = activeRoom();
  if (i === -1) { stillFrames = 0; lastScroll = null; return -1; }
  var sy = window.scrollY || 0;
  if (lastScroll === null) { stillFrames = 0; }
  else if (sy === lastScroll) { stillFrames++; }
  else { stillFrames = 0; }
  lastScroll = sy;
  return stillFrames >= SETTLE_FRAMES ? i : -1;
}

/* Reset the settle timer. Called from resize(), because a resize moves every
   box under the reader and would otherwise present as the scroll having
   changed - dropping the reader back in the car mid-room for a quarter of a
   second every time they nudged the window. */
function resetSettle() { lastScroll = null; stillFrames = 0; }


/* The floor's absolute minimum screen y: high enough that a player standing on
   it fits entirely inside the frame.

   THIS USED TO BE A VIEWPORT FRACTION (a third of the window) and that was the
   bug. Clamping the floor to a fraction of the viewport pinned every room to a
   fixed screen position no matter where it sat in the document - the room
   stopped scrolling with the rock and hung in the frame like an overlay, while
   the text beside it slid past. It is the same clamp the bottom cave needs,
   applied for the same reason the bottom cave needs it, and it is wrong here.

   The bottom cave is a short band at the very end of the document, so pinning
   it costs nothing. A side room is a real cell in the middle of the page, so
   pinning it is the whole feature not working.

   What actually has to be true is only that the player can STAND here: the
   floor cannot come above the sprite's own height, or there is nowhere to be.
   That is an absolute number and does not move with the window. */
function floorMinY() {
  return ROOM_SPRITE_MIN + 2 + ROOM_RELIEF;
}

/* Screen-space floor y for a room at a screen x: the world profile, plus the
   room's document top, minus the live scroll - the ONE place world becomes
   screen. A stored screen y would be stale the instant the reader scrolled.

   Clamped ONLY to floorMinY(), which is the sprite-fits constraint and nothing
   else. The floor therefore tracks the room through the document exactly as the
   text beside it does. */
function screenFloorY(i, screenX) {
  if (!roomActive(i)) return NaN;
  var box = rooms[i].box;
  /* THE TRUE DOCUMENT POSITION. NO CLAMP, AND THE ABSENCE IS THE FIX.

     This used to be clamped to floorMinY(), copied from the bottom cave, where
     the clamp is correct: the reader is standing in that room and the floor must
     not rise above their head on a short viewport.

     A side room has nobody standing in it. The only thing the clamp did there was
     pin the drawn floor to a fixed line near the top of the frame, and the effect
     was that the room STOPPED SCROLLING. For the ore gallery that is roughly 400px
     of scroll - from about 540 to 934 - during which the cell slid up and out of
     view while its floor sat pinned at y=80, still being painted because
     visibleRooms() counts a sliver. That is the "the room follows me" report: the
     room is welded to the viewport while the text beside it slides away.

     The clamp belonged to the model where the player could be put into these rooms.
     That model is gone - see the teleport removal - so the clamp went with it, and
     it should not come back with a walk-through either. When the player can walk
     in, the constraint that the floor fits below their head belongs in COLLISION,
     where it keeps them on screen, and not in the number the renderer draws. */
  return floorAt(i, screenX) + box.top - (window.scrollY || 0);
}

/* === The entrance ==========================================================
   The doorway on the wall facing the shaft. It is drawn, and it is on the correct
   side, but nothing walks through it yet: there is no path from the shaft into a
   room, and the teleport that used to fake one is gone. See movePlayer() in
   game.js. The artwork and the geometry are here so the walk-through is a
   collision change rather than a redraw.

   It goes on the wall FACING THE SHAFT - a left-column room's door is on its
   right edge, a right-column room's on its left - chosen from the room's own
   geometry rather than a per-room flag, so it cannot land on the outside wall
   of the page. Returned as an x and a side because the drawing needs to know
   which way it faces and the collision needs to know where to put the player. */
function entranceSide(i) {
  if (!roomActive(i)) return 0;
  var box = rooms[i].box;
  var mid = (box.left + box.right) / 2;
  /* Left-hand room -> the shaft is to its right -> door on the right wall. */
  return mid < (viewW / 2) ? 1 : -1;
}

function entranceX(i) {
  if (!roomActive(i)) return NaN;
  var b = bounds(i);
  return entranceSide(i) > 0 ? b.right : b.left;
}

/* The roof, in screen space, from the floor. Never above the top of the frame
   and never so high that standing on this floor puts the sprite's head above
   it. Derived from the FLOOR rather than from the viewport - that is the bound
   that actually constrains it, and deriving it from the viewport instead was
   tried and fixed nothing. */
function roofY(i) {
  if (!roomActive(i)) return NaN;
  var floor = screenFloorY(i, 0);
  if (!isFinite(floor)) return NaN;
  var maxByHead = floor - ROOM_SPRITE_MIN - 1;
  if (maxByHead < 0) maxByHead = 0;
  var want = Math.min(220, maxByHead);
  if (want < 1) want = 1;
  return floor - want;
}

/* The room's own left and right walls, inset so the player cannot walk out of
   the side into the text panel. Uses the MEASURED box, not the viewport: the
   point of a side room is that it is narrower than the page, and reading the
   viewport here would give every room full-width bounds and make the walls
   invisible. */
function bounds(i) {
  if (!roomActive(i)) return { left: 0, right: ROOM_SPRITE_MIN };
  var box = rooms[i].box;
  var left = box.left + ROOM_MARGIN;
  var right = box.right - ROOM_MARGIN;
  /* A column too narrow to stand in must not invert into a negative width.
     The floor of 1 keeps the bounds ordered; the room is then simply unwalkable
     rather than teleporting the player across the screen. */
  if (!(right > left)) right = left + 1;
  return { left: left, right: right };
}

/* Put the player just INSIDE the entrance, on the floor, rather than wherever
   they happened to be standing in the shaft.

   This is the difference between walking into a room and being teleported into
   one: the arrival point is the doorway, so the room reads as having been
   entered through its own door, and leaving is the same journey in reverse.

   The x is nudged INWARD from the door by the player's own width, not by a
   constant, so they never start embedded in the wall - and the nudge is signed
   by which wall the door is on, so a room entered from its left is not dropped
   out through it. */
function enterRoom(i, player) {
  if (!roomActive(i)) return false;
  var b = bounds(i);
  var side = entranceSide(i);
  if (side > 0) {
    player.x = b.right - player.w - 4;
  } else if (side < 0) {
    player.x = b.left + 4;
  } else {
    /* No wall faces the shaft - a degenerate room. Fall back to the middle
       rather than picking an edge and guessing. */
    player.x = Math.round((b.left + b.right) / 2 - player.w / 2);
  }
  player.x = Math.max(b.left, Math.min(player.x, b.right - player.w));
  player.y = screenFloorY(i, player.x + player.w / 2) - player.h - 8;
  player.vx = 0;
  player.vy = 0;
  return true;
}

/* Hand the player back to the shaft, at the middle of the viewport, which is
   where the shaft column is on a desktop layout. movePlayerShaft() clamps them
   into the actual shaft on its next call, so the exact column does not matter
   here - only that it is a finite number near the centre. */
function leaveRoom(player) {
  player.x = Math.round(viewW / 2 - player.w / 2);
  if (!isFinite(player.x)) player.x = 0;
  player.vx = 0;
  player.vy = 0;
  return true;
}

/* Exported as a block, not inline on each function. The module loader and the
   graph check in tools/smoke.mjs both work on the block form; an inline export
   is left unrewritten and becomes a syntax error the moment the file is
   evaluated. contact.js documents the same trap from the other side. */
export {
  measureRooms,
  activeRoom,
  visibleRooms,
  settledRoom,
  resetSettle,
  roomActive,
  roomLayer,
  floorAt,
  floorMinY,
  entranceX,
  entranceSide,
  screenFloorY,
  roofY,
  bounds,
  enterRoom,
  leaveRoom,
  setShaftEdges,
  surfaceAt,
  shaftWallBlocks,
  DEFS
};

