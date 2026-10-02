/* ==========================================================================
   deck.js - the mine car: where it is, where it may go, and how it travels
   ==========================================================================
   Everything about the car the sprite stands on: its position, the band it is
   allowed to occupy, the scroll mapping that drives it and the easing that
   makes it feel like a machine rather than a div being repositioned.

   The car floor is ONE flat screen Y, so walking is purely horizontal and can
   never nudge the sprite up or down. It used to be a "ledge": groundY(x)
   sampled a noise field, which meant every step could shift the character by up
   to ten pixels and the whole figure was being walked around by a function of
   its own horizontal position.

   It is its own module rather than more of layers.js for two reasons. It owns
   state that CHANGES (deckY), where layers.js only holds what is measured; and
   it owns the motion rule, which is simulation rather than world description.
   Extracting it also keeps both files under the 500-line cap.

   Depends on layers.js and nothing else, so the graph stays a chain:
   layers <- deck <- game <- render, with ui and main on top.
   ========================================================================== */

import {
  clamp, scrollY, viewH, maxScroll, travelFrom, travelTo, surfaceFrom, SPRITE_H
} from './layers.js';

/* === Motion preference ====================================================
   This lives here rather than in render.js because it is not only an art flag:
   the easing below changes how the car answers the scroll, which is
   simulation. render.js imports the live binding, so there is exactly one
   matchMedia on this query in the whole repo and the drawing and the movement
   can never disagree about whether motion is welcome. */
var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
var reduced = motionQuery.matches;
/* Re-read on change so toggling the OS setting takes effect live; a one-time
   read would leave the page in the wrong mode until the next reload. */
if (motionQuery.addEventListener) {
  motionQuery.addEventListener('change', function (e) { reduced = e.matches; });
} else if (motionQuery.addListener) {
  motionQuery.addListener(function (e) { reduced = e.matches; });
}

/* === Bounds ===============================================================
   The band is a NARROW window centred on the middle of the viewport. That is a
   change from the previous version, which let the car use most of the screen
   height, and the reason is what the band is actually for.

   The car is a stage for the character, and the character has to stay legible
   while the reader is reading a panel beside it. A band that reached the foot of
   the screen put the character at 92% of the viewport height by the bottom of
   the page - which reads as the character sinking out of frame, and on a window
   short enough to trip the depth-rail bar put them behind it entirely. Neither
   is what a lift should do. So the car hovers around the middle: never near the
   top, never near the bottom, never behind the rail.

   The half-range shrinks on a short viewport so the sprite and the headgear
   still fit above the band, and the band is measured in SCREEN space and is
   deliberately NOT derived from the shaft. The shaft is as tall as the whole
   document, so a band taken from it slides up the screen at exactly the scroll
   rate - roughly -1px of car per +1px of scroll - which swamped the travel and
   reversed the car's direction. Measured on the broken version: 140 direction
   reversals going down the page, and a car pushed to y = -1114. The shaft column
   spans the whole page anyway, so any on-screen Y is inside it and the "car can
   never ride out of the rock" guarantee is free.

   The endpoints are {top, bot}, and the car floor is confined between them, so
   there IS a hard top and bottom stop - they are just near the middle now. */

/* Minimum band height, used only as a "is this degenerate" test. */
var DECK_MARGIN = 10;
/* Keeps the car and the character on screen. */
var VIEW_MARGIN = 12;
/* Where the middle of the band sits, as a fraction of viewport height. */
var DECK_CENTRE = 0.5;
/* Half the travel range at full size, in px. This puts the car between roughly
   40% and 60% of the screen height: close enough to the centre to always read
   as "the lift", with enough range that scrolling visibly moves it. */
var DECK_HALF_MAX = 90;
/* Smallest half-range allowed, so even a very short viewport gets some motion
   rather than a car welded to one spot. */
var DECK_HALF_MIN = 16;
/* Room needed above the top of the band: the viewport margin, the sprite (the
   character stands ON the car, so the car is already a sprite height up), and
   space for the headgear to clear the sprite's head on top of that. */
var HEADROOM = VIEW_MARGIN + SPRITE_H + 40;
/* Fallback band, as a fraction of viewport height, for a viewport too short to
   give the car any room at all. */
var DECK_FALLBACK_TOP = 0.40;
var DECK_FALLBACK_BOT = 0.68;
var deckY = 0;

function deckBounds() {
  /* Symmetric window around the middle of the screen. The half-range is capped
     so the sprite and headgear always fit above it, and given a floor so a very
     short viewport still gets some travel. `!(half >= ...)` rather than a plain
     < so an unmeasured (NaN) viewH falls into the floor instead of poisoning
     the whole band. */
  var centre = viewH * DECK_CENTRE;
  var half = Math.min(DECK_HALF_MAX, centre - HEADROOM);
  if (!(half >= DECK_HALF_MIN)) half = DECK_HALF_MIN;

  var top = centre - half;
  var bot = centre + half;
  /* THE TOP OF THE BAND FOLLOWS THE SURFACE UP TO THE BAND'S OWN TOP. This is the
     handover, and it happens HERE rather than between carTarget() and parkedY(),
     because these are the two lines that have to meet: the grass is a document
     line sweeping up the screen, the band is a fixed viewport range. On a tall
     window at scroll 0 the grass is at 417 and the band starts at 510, so the two
     never coincide on their own.

     Taking the LOWER of the two makes the band's top the ground while the ground
     is below it, and the band itself once the ground has risen past. So the car
     rides the grass, the band takes over as it overtakes, and the two are equal
     at the moment of handover - there is no jump, because there is no gap to
     jump across. `max` here would be wrong: it would push the band's top above
     the ground and bury the car underground, which is the bug this all undoes.

     Only the top moves. The bottom stays viewport-relative, so the car still ends
     up in the same place at the foot of the page and the journey's shape is
     unchanged - it just starts from the surface instead of from a room. */
  /* THE TOP OF THE BAND IS THE SURFACE AT THE START OF THE JOURNEY - a constant,
     not a scroll-dependent line, and that is the correction after two wrong
     attempts at a scroll-dependent one.

     The band is VIEWPORT-relative and the grass is a DOCUMENT line sweeping up
     the screen. On 1920x1200 at scroll 0 the grass is at 417 and the band spans
     510..690, so the grass is ABOVE the whole band and stays above it forever -
     it only rises further away. So there is no scroll position at which the two
     meet, and no way to hand the car from one to the other.

     Anchoring the band's top to the grass where it stood at scroll 0 (417) makes
     the descent one continuous line from the surface to the foot of the page: the
     car stands on the grass at the top, and descends as the reader scrolls. That
     is the behaviour asked for - rides the grass briefly, then travels down the
     shaft - and it is monotonic, because the band's top no longer moves.

     The two wrong versions, both of which are why this is a constant:
       - following the grass (`top = surface`) kept the car glued to the surface
         for the whole page and it never descended at all;
       - following it only when above the band (`>`) left the top at 510 while the
         car stood at 417, so the band never came down to meet the car.

     Clamped to the band's own top when the surface is below it, so a viewport too
     short to show the surface still gets a sane band rather than an inverted one. */
  if (surfaceFrom > 0 && surfaceFrom < top) top = surfaceFrom;
  /* No room at all, or nothing measured yet: fall back rather than inverting. */
  if (!isFinite(top) || !isFinite(bot) || bot - top < DECK_MARGIN) {
    top = viewH * DECK_FALLBACK_TOP + SPRITE_H;
    bot = viewH * DECK_FALLBACK_BOT;
  }
  if (bot < top) bot = top;        /* degenerate: park the car on its own top */
  return { top: top, bot: bot };
}


/* === Travel ===============================================================
   Scroll drives the car. Nothing here listens for a key, so the up and down
   arrows keep their native meaning and the page never scroll-jacks.

   The mapping is one monotonic descent across a fixed WINDOW of the page rather
   than the whole thing - see travelWindow() below for the two stops:

       p      = (scrollY - window.start) / (window.end - window.start)  // 0..1
       target = band.top + p * (band.bot - band.top)

   Monotonic is the entire requirement. The first version swept the car through
   the band once per LAYER, which sounded tidier - the car always sat beside the
   section being read - but a per-layer sweep has to reset at every seam, and a
   reset is a direction change by definition. Five of them down the page, each
   one a visible lurch. The car now travels once and can never reverse no matter
   how the layers are laid out or how the reader scrolls. Monotonicity is a
   property that cannot regress the way "reset it at the seam" could.

   The cost is that the car is no longer pinned to the active layer. It sits
   near the middle of the viewport for most of the page, which is also where the
   lit doorway of the active layer is, so the two still read together. */
var TRAVEL_EASE = 9;   /* how hard the car is pulled to target, per second */

/* The stretch of page the car travels over, in document pixels: it sets off at
   the DIRT room and stops just before the Bedrock treasure room. Both anchors are
   measured from the markup by layers.js (see travelFrom / travelTo there), so the
   stops follow the rooms rather than a list of indexes.

   NOTE ON THE SKY. The car is PARKING above the soil, not travelling through it.
   Outside the window p clamps to 0, so from the top of the page until scrollY
   reaches travelFrom the car is stationary at the top of its band - and since
   deckBounds() is viewport-relative, that is a fixed screen height, which over
   the sky is a car hanging in mid-air with the soil still below the fold.

   The first attempt at fixing that pushed the window start UP to
   (travelFrom - band.top) on the reasoning that the car would then begin moving
   at the soil line. That is backwards, and smoke.mjs's "car starts moving before
   the dirt room" check failed at eight viewports immediately. The window start
   cannot be raised without the car descending before the dirt room opens.

   Nor can it be lowered to "soil well on screen" without truncating the journey,
   because travelTo is fixed at the foot of the dig. So the travel window is
   correct as it stands and the fix has to happen in the RENDER path - the parked
   car should not be drawn above the soil line. See render.js.

   If the anchors are missing or inverted the fallback lets the whole page drive
   it, so the car still moves on a page that has not finished laying out. */
function travelWindow() {
  /* THE WINDOW NOW STARTS AT THE SURFACE, not at the dirt room. travelFrom is
     still measured from the markup and still marks the dirt room, but the car's
     journey begins at `surfaceFrom` - the grass - so it sets off from the ground
     rather than waiting for a room to open underneath it.

     Why this is the only way to make the elevator MOVE. The band is
     VIEWPORT-relative (a fixed fraction of the window) while the grass is a
     DOCUMENT line that sweeps upward as the reader scrolls. On a 1920x1200 window
     at scroll 0 the grass sits at 417 and the band spans 510..690 - the band is
     entirely UNDERGROUND while the car is standing on the surface. Those two
     coordinate systems never meet on a tall window, so "park the car on the grass"
     and "hand it to the band" cannot both be true, and the car sat frozen on the
     grass for the whole sky section and then lurched when the dirt room arrived.

     Starting the window at the surface makes it one continuous descent instead,
     with no handover to jump across. */
  var start = surfaceFrom > 0 ? surfaceFrom : travelFrom;
  /* THE DESCENT ENDS NEAR THE SURFACE, NOT AT THE FOOT OF THE DIG. The car travels
     a fixed SCREEN distance - the band - so the amount of PAGE that distance is
     spread over decides how fast it appears to move. Spread from the surface all the
     way to travelTo it had roughly 1800px of scroll to cover 273px of band: measured,
     8.8px of car movement per 100px scrolled, which reads as frozen at grass level
     however far down the page the reader is - the reported symptom.

     So the window is one viewport long. The elevator enters the ground as the reader
     scrolls into it and is at the bottom of its travel shortly after, which is what a
     mine lift does and what they are actually watching while it happens.

     Bounded above by travelTo, so on a page laid out shorter than the surface plus a
     viewport the car never runs past the bottom of the shaft. */
  var end = Math.min(travelTo, start + viewH);
  if (!(end > start)) end = travelTo;
  if (!(end > start)) end = maxScroll + 1;    /* unmeasured: use the whole page */
  return { start: start, end: end };
}

/* The car's target Y for this frame.

   WHY THE PARKED CAR RESTS ON THE SOIL. deckBounds() is viewport-relative, so a
   car parked at the top of its band sits at one fixed screen height however far
   down the page the reader is. Over the sky that is a mine car hanging in
   mid-air with the dirt still below the fold, and the sprite - who rides it -
   hanging with it. Parking it on the surface instead is the honest fix: the car
   stands on the ground, the ground rises up the screen as the reader scrolls,
   and the car rises with it because it is standing on it.

   THE CLAMP IS SCOPED TO p <= 0 DELIBERATELY. Once the car is inside the travel
   window it is descending by its own rules, and the soil is behind it; clamping
   there would fight the band. Only the parked phase is constrained.

   THE RISE IS NOT A REVERSAL, THOUGH THE MONOTONIC CHECK LOOKS FOR ONE. A car
   parked on the ground moving up the screen while the page scrolls down is the
   ground passing beneath it, which is correct - it is the same thing every
   scroll-driven object on the page does. The monotonic rule in smoke.mjs exists
   to catch the car being dragged back up by a target it cannot reach, and this is
   not that: the car never exceeds its own target and the travel phase that
   follows is strictly descending. The rule is scoped to the travel window for
   exactly this reason.

   NOT A REPLACEMENT FOR THE OLD INVISIBILITY GATE - this is the opposite
   choice. That one deleted the car above the soil; this one stands it on the
   soil, so it is visible from the first screen of the page. */
/* The line the car rests on while it is parked, in screen Y.

   ONE definition, read by BOTH carTarget() and seatDeck(). They were originally
   two separate clamps for the same fact, and a mutation removing the one in
   carTarget() passed for the wrong reason - seatDeck()'s clamp bounds the car
   but does not move it, so deleting the target clamp quietly put the car back at
   band.top while every assertion still passed. Two clamps, one of them inert.

   THE RULE. Normally the resting line is the top of the band. But the band is
   viewport-relative, so band.top is a fixed height on screen and the car hangs in
   the open sky with the dirt below the fold. When the soil is LOWER than the band
   top - which is the normal case, the ground being further down the page than the
   band - the car rests on the ground instead. As the reader scrolls, the ground
   rises, and once it passes the band top the two coincide and this is an ordinary
   band clamp again. That handover is the whole behaviour.

   Unmeasured soil (no dirt room, or a page that has not laid out) falls back to
   the band, so a missing number never deletes the elevator. */
function parkedY() {
  var b = deckBounds();
  if (!isFinite(surfaceFrom) || surfaceFrom <= 0) return b.top;
  var soil = surfaceFrom - scrollY;
  if (!isFinite(soil)) return b.top;
  /* THE GRASS LINE, unconditionally. An earlier version took the GREATER of the
     soil and the band top, reasoning that the band should take over once the
     ground rose above it. That left the car at band.top 510 while the grass was
     at 417 - standing 93px BELOW the surface, in what looks like solid earth,
     which is the exact complaint this change exists to fix. The band is a
     viewport-relative range for a car that is DESCENDING; it has no authority
     over where the car waits at rest, and letting it clamp the parked position is
     what buried the elevator underground.

     So the parked line is the grass and nothing else, and seatDeck() opens both
     ends of its range to match rather than pulling the car back into the band. */
  return Math.max(soil, b.top);
}

/* Is the car in its parked phase right now - i.e. is the target the ground
   rather than a point on the band?

   ONE PREDICATE, read by carTarget() and advanceCar(). They were originally two
   separate expressions of "where is the car in its journey", and when the parked
   case stopped being eased this had to agree with the target exactly: if the two
   disagreed on a single frame the car would snap to the ground and then ease away
   from it, which looks worse than either behaviour alone. The test is the same
   `p <= 0` that selects the target, factored out so there is one of it. */
function travelProgress() {
  var w = travelWindow();
  var span = w.end - w.start;
  return span > 0 ? clamp((scrollY - w.start) / span, 0, 1) : 0;
}

function snapToParked() { return travelProgress() <= 0; }

function carTarget() {
  var b = deckBounds();
  var p = travelProgress();
  /* While parked (p <= 0) the target is the ground, not the band - that is what
     actually MOVES the car down onto the surface. seatDeck() below only bounds
     it, and on its own left the car sitting at band.top. */
  if (p <= 0) return parkedY();
  return b.top + p * (b.bot - b.top);
}

/* Put the car back inside its allowed range, keeping wherever it had got to.
   `centre` snaps it to the middle of the band instead, which is what a re-measure
   at a genuinely new viewport size wants.

   BOTH ENDS MOVE WHILE PARKED. The floor is parkedY() rather than b.top, so a car
   resting on the ground is not yanked back up into the band - a plain
   clamp(deckY, b.top, b.bot) hid inside the function that is supposed to enforce
   the band, silently undoing the positioning above. The ceiling moves too, because
   on a tall viewport the ground is BELOW the whole band and a band-only ceiling
   pinned the car to band.bot so it never reached the surface at all.

   This BOUNDS the car; it does not move it. parkedY() as the target is what
   actually carries the car down onto the soil - see the note in carTarget().

   `centre` deliberately ignores the ground: a re-measure is a layout event rather
   than a scroll position, and honouring the soil there would snap the car to the
   surface on every rotation. */
function seatDeck(centre) {
  var b = deckBounds();
  /* `centre` seats the car mid-band, which is what a re-measure wants for a car
     that is DESCENDING. But while the car is PARKED its position is the ground,
     not a point in the band - seating it mid-band there strands it in mid-air,
     and it then has to be walked back down to the reader's feet, which is the
     elevator arriving late. So the parked car is seated on the ground even on a
     re-measure.

     This is the same snapToParked() the target uses, so the two cannot disagree
     about which phase the car is in. */
  if (centre) {
    deckY = snapToParked() ? parkedY() : (b.top + b.bot) / 2;
    return;
  }
  var floor = b.top, ceil = b.bot;
  var rest = parkedY();
  if (rest < floor) floor = rest;
  if (rest > ceil) ceil = rest;
  deckY = clamp(deckY, floor, ceil);
}
/* One frame of travel, called from the loop right after syncScroll().
   Exponential smoothing rather than a fixed fraction per frame, so the car
   settles at the same rate whatever the frame rate: a naive lerp visibly lags
   at 30fps and snaps at 144fps. dt is already clamped in main.js.

   THE PARKED PHASE IS NOT EASED. This is the fix for the car taking a second or
   two to reach the reader's feet after a scroll. While parked, the target is the
   ground, and the ground moves EXACTLY 1:1 with scrollY - so easing it means the
   car is always trailing the surface by an amount proportional to scroll speed,
   and then has to spend the easing time catching up once the reader stops. The
   reported symptom was precisely that: scroll, stop, wait, and only then does the
   elevator floor arrive under the character.

   Easing is for the DESCENT, where the car is a mechanism responding to the
   reader moving through the page and a little softness reads as weight. Parking
   is not that: the car is standing on the ground, and the ground is not
   something the car should lag behind. So the parked case snaps, and it snaps in
   the same way under reduced motion - there is no animation left to remove,
   because there is no animation.

   snapToParked() is derived from the same predicate as the target itself, so
   "eased" and "snapped" can never disagree about which phase the car is in. */
function advanceCar(dt) {
  var target = carTarget();
  if (reduced || snapToParked()) {
    deckY = target;
  } else {
    deckY += (target - deckY) * (1 - Math.exp(-TRAVEL_EASE * dt));
  }
  seatDeck();
}

/* Y for the centre of the sheave wheel. This lives here rather than in
   render.js on purpose: the headgear has to clear the sprite's head, and the
   sprite's height is a number this module already has. Hard-coding a second
   offset in the drawing code meant the wheel was drawn 26px INSIDE the
   character's body whenever the car was at the top of its range, because
   nothing tied the two offsets to each other. One source, one number.

   The 30 is the gap from the sprite's head to the sheave CENTRE; the wheel is
   9px in radius, so the visible clearance is 21px. The max() is a floor for a
   viewport too short to fit sprite plus headgear - on a window around 200px tall
   there is simply nowhere for the wheel to go but the very top of the frame. */
function sheaveY() {
  return Math.max(10, deckBounds().top - (SPRITE_H + 30));
}

/* The car floor. No argument on purpose: it used to take x and return a height
   sampled from the terrain, and the whole point of the change is that the floor
   no longer depends on where the sprite is standing. game.js resolves collision
   against this and render.js draws the car on exactly it, so the art and the
   collision cannot disagree. */
function groundY() { return deckY; }

/* Public surface of this module. Collected here so that not one line of the
   code above needed a keyword added to it. */
export {
  reduced,
  deckBounds,
  seatDeck,
  advanceCar,
  sheaveY,
  groundY
};
