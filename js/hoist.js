/* ==========================================================================
   hoist.js - the headgear, the cables and the car
   ==========================================================================
   PURPOSE. The machinery at the top of the shaft and the car at the bottom of it:
   the sheave wheel and its bracket, the cables between them, and the car itself.
   Moved out of render.js, which was 143 lines over the 500-line cap this repo
   works to and had no art left in it that belonged there.

   WHY ITS OWN FILE AND NOT deck.js. deck.js owns the CAR GEOMETRY - where it is,
   when it moves, when it is parked - and this is the car's PICTURE. Close enough
   to be one subject, different enough to be different jobs, and merging them
   would put a 140-line drawing routine into the one module whose tests are about
   numbers. deck.js is 431 lines; this would have taken it to 571, which trades one
   file over the cap for another.

   THE ONE IDEA WORTH KEEPING. The cables are load-bearing: a cable's length is the
   car's position expressed as a distance from the sheave, so as the car travels
   they visibly stretch and slacken. Nothing else in the frame moves vertically at
   this rate, which is what makes the motion read as weight on a rope rather than
   as a sprite sliding down a line. It is also why the car and the cables must be
   drawn from the SAME number - two consumers of one fact that disagree is the seam
   twitch all over again.

   px() is a copy rather than an import: render.js has the original, importing it
   back would be a cycle, and it is three lines. The snapping matters on HiDPI,
   where a fractional fill blurs a whole pixel.
   ========================================================================== */

import { ctx, viewH, shaftLeft, shaftRight } from './layers.js';
import { deckBounds, sheaveY, groundY } from './deck.js';
import { player } from './game.js';

/* How many times the car was actually drawn this frame. A DIRECT check, not a
   proxy rect count: a proxy said "the cave draws less than the shaft, so the car
   is gone", which held until the cave gained real art and then failed for a
   reason having nothing to do with the car. 0 in the cave means the car is
   provably not drawn, however much art surrounds it. tools/smoke.mjs asserts both
   directions. */
var carDrawn = 0;
function resetCarDraws() { carDrawn = 0; }

/* One snapped, axis-aligned pixel rect. */
function px(x, y, w, h, colour) {
  ctx.fillStyle = colour;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawHoist() {
  var l = shaftLeft(), r = shaftRight();
  var y = groundY();
  var b = deckBounds();
  var mid = (l + r) / 2;
  var sheave = sheaveY();

  /* The player has left the car. Once they are in a room there is nobody riding
     it, and a car drawn hanging in mid-air over the room with an empty floor
     under it reads as a bug rather than as a mechanism. The shaft walls stay -
     they still frame the room's mouth - but the hoist goes.

     Gated on where the player actually IS rather than on caveActive(): those are
     not the same question. caveActive() is about where the reader has scrolled
     to; inCave is about where the player is, and it is the one movePlayer()
     decides. Drawing the car based on the scroll would hide it while the player
     was still standing on it.

     `inRoom !== -1` is the SAME check applied to the four side rooms. Without it
     the car would vanish the moment the reader scrolled a room into view, even
     though the player was still aboard it - the car is the reader's transport
     and it is what they are standing in until a room actually takes them. */
  if (player.inCave) return;

  /* Car parked below the foot of the screen: nothing of this is visible. */
  if (y > viewH + 40) return;

  /* --- Sheave wheel and bracket, above the top of travel ------------------- */
  var wheelR = 9;
  /* Bracket: two bars straddling the wheel, bolted across the shaft. */
  px(l + 2, sheave - 4, r - l - 4, 3, 'rgba(0,0,0,0.50)');
  px(l + 2, sheave + 1, r - l - 4, 3, 'rgba(0,0,0,0.50)');
  /* Wheel: three stacked bars make a blocky disc, which stays pixel-aligned
     instead of going soft and antialiased the way an arc would. */
  px(mid - wheelR, sheave - 2, wheelR * 2, 5, 'rgba(0,0,0,0.62)');
  px(mid - wheelR + 2, sheave - 5, wheelR * 2 - 4, 11, 'rgba(0,0,0,0.62)');
  px(mid - wheelR + 4, sheave - 3, wheelR * 2 - 8, 7, 'rgba(255,210,74,0.16)');
  /* Hub and spokes, so the wheel reads as something that turns. */
  px(mid - 1, sheave - 1, 2, 2, 'rgba(255,255,255,0.30)');
  px(mid - wheelR + 2, sheave - 1, wheelR * 2 - 4, 1, 'rgba(255,255,255,0.10)');
  px(mid - 1, sheave - wheelR + 1, 1, wheelR * 2 - 2, 'rgba(255,255,255,0.10)');

  /* --- Cables -------------------------------------------------------------
     Two taut lines from the wheel down to the car's lifting eyes. Dotted
     rather than solid so they read as chain at this pixel scale, and stepped
     in 2px so the per-frame cost stays trivial. Both runs are bounded because
     the sheave is anchored to the top of the travel band, which is on screen. */
  var carY = y - 3;
  for (var c = sheave + 6; c < carY; c += 2) {
    px(mid - 3, c, 1, 1, 'rgba(255,210,74,0.20)');
    px(mid + 3, c, 1, 1, 'rgba(255,210,74,0.20)');
  }
  /* Where the cables meet the car. */
  px(l + 16, carY - 4, 5, 2, 'rgba(0,0,0,0.55)');
  px(r - 21, carY - 4, 5, 2, 'rgba(0,0,0,0.55)');

  /* --- Counterweight ------------------------------------------------------
     Mirrored through the band: car at the top means weight at the bottom. The
     span guard matters because a pathological viewport can invert the band, and
     a mirrored position would then run the weight off the screen entirely. */
  var span = b.bot - b.top;
  var weightY = y;
  if (isFinite(span) && span > 0) {
    weightY = b.top + (b.bot - y);
    if (weightY < b.top - 20 || weightY > b.bot + 20) weightY = (b.top + b.bot) / 2;
  }
  var wx = r - 9;
  /* Its own short cable, so the weight is visibly hung rather than floating.
     Bounded for the same reason as the hoist ropes: the sheave is on screen. */
  if (weightY > sheave + 10) {
    for (var w = sheave + 8; w < weightY - 8; w += 3) {
      px(wx, w, 1, 1, 'rgba(255,255,255,0.13)');
    }
  }
  px(wx - 3, weightY - 8, 7, 16, 'rgba(0,0,0,0.55)');
  px(wx - 2, weightY - 7, 5, 14, 'rgba(255,255,255,0.07)');
  px(wx - 3, weightY - 2, 7, 1, 'rgba(255,255,255,0.14)');
  px(wx - 3, weightY + 2, 7, 1, 'rgba(255,255,255,0.14)');

  drawCar(y, l, r);
}

/* The car itself: a plate the sprite stands on, with side shoes riding the
   guides. The lit lip is drawn at EXACTLY the Y game.js resolves collision
   against - groundY() - so the sprite can neither float above the car nor sink
   into it. That shared number is the whole reason the two cannot drift apart.

   There is no rock floor beneath it any more, and that is deliberate: a car in
   a shaft hangs in the shaft. Painting a fixed mass of rock below the deck
   would imply a floor to stand on, which is exactly the thing this change
   removed. What is below is dark shaft, which is where the counterweight and
   the cables run.

   Clipped to the shaft box, so the plate and the weight never run out over the
   rock where the panel text sits. */
function drawCar(y, l, r) {
  carDrawn++;
  ctx.save();
  ctx.beginPath();
  ctx.rect(l - 8, 0, r - l + 16, viewH);
  ctx.clip();

  /* Underframe, drawn first so the deck plate overlaps its top edge. */
  px(l - 6, y + 2, r - l + 12, 4, 'rgba(0,0,0,0.60)');
  /* Side shoes: the blocks that grip the guide rails, one each side. */
  px(l + 10, y - 3, 7, 6, 'rgba(0,0,0,0.62)');
  px(r - 17, y - 3, 7, 6, 'rgba(0,0,0,0.62)');
  px(l + 11, y - 2, 5, 2, 'rgba(255,255,255,0.10)');
  px(r - 16, y - 2, 5, 2, 'rgba(255,255,255,0.10)');
  /* The deck: a solid plate with a lit top edge and a shaded body. */
  px(l - 8, y, r - l + 16, 2, 'rgba(255,210,74,0.28)');
  px(l - 8, y + 2, r - l + 16, 6, 'rgba(0,0,0,0.72)');
  px(l - 8, y + 2, r - l + 16, 1, 'rgba(255,255,255,0.12)');
  /* Rivet line along the plate, so the car has a front face. */
  for (var rivet = l - 4; rivet < r + 4; rivet += 9) {
    px(rivet, y + 5, 1, 1, 'rgba(255,255,255,0.10)');
  }
  ctx.restore();          /* release the shaft clip */
}

export { drawHoist, drawCar, resetCarDraws, carDrawn };
