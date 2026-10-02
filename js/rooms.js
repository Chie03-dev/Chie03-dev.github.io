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
  var y = floorAt(i, screenX) + box.top - (window.scrollY || 0);
  var min = floorMinY();
  if (y < min) y = min;
  return y;
}

/* === The entrance ==========================================================
   The doorway between the shaft and a room, so the reader WALKS in rather than
   being teleported. The player is placed just inside it on arrival and has to
   walk back out through it to leave, which is the difference between a room and
   a cutscene.

   It goes on the wall FACING THE SHAFT, because that is the only wall a reader
   could arrive from: the shaft is the centre column, so a room in the left
   column is entered from its right edge and a room in the right column from its
   left. Choosing by the room's own geometry rather than by a per-room flag
   means the door cannot end up on the outside wall of the page.

   Returned as an x and a side, because the drawing (room-art.js) needs to know
   which way the opening faces and the collision needs to know where to put the
   player - one number cannot answer both. */
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
  DEFS
};

