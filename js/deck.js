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
  clamp, scrollY, viewH, maxScroll, travelFrom, travelTo, SPRITE_H
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
  var start = travelFrom;
  var end = travelTo;
  if (!(end > start)) end = maxScroll + 1;    /* unmeasured: use the whole page */
  return { start: start, end: end };
}

function carTarget() {
  var b = deckBounds();
  var w = travelWindow();
  var span = w.end - w.start;
  var p = span > 0 ? clamp((scrollY - w.start) / span, 0, 1) : 0;
  return b.top + p * (b.bot - b.top);
}

/* Put the car back inside the band, keeping wherever it had got to. `centre`
   snaps it to the middle instead, which is what a re-measure at a genuinely
   new viewport size wants. Clamped every frame from advanceCar(), so neither a
   font swap nor a rotation mid-journey can strand it outside the band. */
function seatDeck(centre) {
  var b = deckBounds();
  deckY = centre ? (b.top + b.bot) / 2 : clamp(deckY, b.top, b.bot);
}

/* One frame of travel, called from the loop right after syncScroll().
   Exponential smoothing rather than a fixed fraction per frame, so the car
   settles at the same rate whatever the frame rate: a naive lerp visibly lags
   at 30fps and snaps at 144fps. dt is already clamped in main.js. */
function advanceCar(dt) {
  var target = carTarget();
  if (reduced) {
    /* Under reduced motion the car still follows the scroll - that is the
       mechanic, and it is driven by the reader's own input rather than played
       at them. What goes is the easing, which is the part that is animation
       instead of response. */
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
