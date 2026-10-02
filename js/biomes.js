/* ==========================================================================
   biomes.js - the five layer biomes, and where their art can be seen
   Each biome is a placement pass over the sprite set in sprites.js, and none
   of it is an image file. The graph stays a one-way chain:

       layers <- sprites
       layers <- deck  <- biomes <- render
       layers <- sprites <- biomes

   In particular this does NOT import render.js: render.js needs these painters,
   so importing back the other way would close a cycle.

   The real subject of this file is not the shapes, it is the placement. See
   gutters() below for why the old code drew its art somewhere it could never
   be seen.
   ========================================================================== */

import { ctx, viewW, viewH, shaftLeft, shaftRight, layers, scrollY } from './layers.js';

/* === Where a biome is actually visible ===================================
   This is the fix for the panels sitting on top of their own layer.

   Every section IS its chamber panel, so the panel covers the middle of its
   band and all that is left of the biome is the strip outboard of the panel
   and the column gap between the panel and the shaft. On a 1280px screen
   those are about 48px each; on a 1920px one the outboard strip is 184px.

   The old code threw motifs at random across the full viewport width and
   skipped only the shaft corridor, so nearly all of them landed underneath a
   panel and were never seen - which is why the rock read as a flat wash
   around the text rather than as a place.

   `gutters()` returns the two rectangles per band that no panel covers, and
   every sprite is placed inside one of them. The art is now guaranteed to be
   somewhere it can actually be seen, and the panel reads as embedded in the
   biome instead of pasted on top of it.

   Returns [] when the panel is not measured, which is the honest answer: with
   no horizontal box there is no way to know what is covered. */
/* The width available to the MEADOW, which is NOT the same as the width
   available to a band.

   `gutters()` - defined below - excludes the panel's entire horizontal column,
   which is right for a painter that fills the band from top to bottom and wrong
   for the props pass. The trees do not stand in the middle of the band - they
   stand on the seam, which is the BOTTOM of the sky band. The panel sits inside
   the band, so its bottom edge is at least half a row-gap ABOVE the seam, and
   the smallest row-gap is `clamp(14rem, ...)` = 224px, so at least 112px of
   clear rock separates the panel from the soil. A tree is at most ~50px tall.

   So nothing about a tree standing on the seam can be hidden by the panel in
   its own band, and excluding that column just plants the trees in a desert on
   one side. That is the bug: at 1440 the gutters came back as [48, 602], so
   every tree on the page went into the 602px strip on the right and the 48px
   sliver on the left got one.

   The shaft is different and IS excluded here: it is a real element occupying
   that column at the seam's own y, and a tree drawn over it would cover the
   mine. */
function meadowGutters() {
  var sl = shaftLeft(), sr = shaftRight();
  var out = [];
  if (!isFinite(sl) || !isFinite(sr)) return out;
  if (sl > 4) out.push({ x: 0, w: sl });
  if (viewW - sr > 4) out.push({ x: sr, w: viewW - sr });
  return out;
}

/* Cut the viewport at every occluder edge and keep the surviving intervals.
   The old version branched on three hand-written cases, and the case for a
   panel sitting left of the shaft returned the outboard strip and the panel
   gap and then STOPPED - it never added the region outboard of the shaft on
   the far side. With the real numbers (panel 0..543, shaft 591..811, viewport
   1401) that silently threw away 590px, 42% of the screen, which is why the
   right half of the sky was bare blue no matter how much art was thrown at it.

   Deriving the gaps arithmetically instead means a new case cannot be forgotten:
   every interval is tested against the panel and the shaft and kept only if
   nothing covers it. */
function gutters(layer) {
  if (!layer || !isFinite(layer.left) || !isFinite(layer.width)) return [];
  var pl = layer.left, pr = layer.left + layer.width;
  var sl = shaftLeft(), sr = shaftRight();

  /* Slice the viewport at every occluder edge, then keep the slices that
     neither the panel nor the shaft covers. Doing it this way means a new
     layout cannot fall through a missing branch. */
  var edges = [pl, pr, sl, sr], cuts = [0], i, j;
  for (i = 0; i < edges.length; i++) {
    if (isFinite(edges[i]) && edges[i] > 0 && edges[i] < viewW) cuts.push(edges[i]);
  }
  cuts.sort(function (a, b) { return a - b; });
  cuts.push(viewW);

  var out = [];
  for (j = 0; j < cuts.length - 1; j++) {
    var x = cuts[j], w = cuts[j + 1] - cuts[j];
    if (w <= 4) continue;
    var mid = x + w / 2;
    if (mid > pl && mid < pr) continue;   /* under the panel */
    if (mid > sl && mid < sr) continue;   /* inside the shaft */
    out.push({ x: x, w: w });
  }
  return out;
}

/* Blit a baked sprite at an integer scale, choosing the largest scale that
   still fits the gutter. Integer scaling is what keeps the pixel art crisp;
   a fractional scale would blur every edge, which is the one thing this art
   must never do. */
/* The integer scale blit() will use for this sprite in this much room. Callers
   that need to position a sprite BY ITS BOTTOM EDGE must ask for the scale
   rather than assuming it: the old sky biome wrote `spr.height * 2` while
   blit() chose k from the gutter width, so a 30px conifer in the 48px gutter
   was scaled by 1 but placed as if scaled by 2 - every tree on the surface
   floated 30px above the grass it was supposed to be standing on. */
/* The sprite-placement helpers moved to place.js and the sky painter moved to
   biome-sky.js. Both are re-exported below, so render.js and the pixel test
   keep importing from this one module and the refactor stays invisible. */
import { skyBiome, skyProps, sunSpot, TREE_W, TREE_GAP, TREE_SINK } from './biome-sky.js';
import { scaleFor, blit, blitOn } from './place.js';


/* === The five biomes ====================================================
   Each painter receives the band in SCREEN space plus the gutters, and places
   its own shapes. Only the sky has a painter left; the rock bands are painted
   geometrically in render.js and have nothing to place. See bareBiome below.

   The cell-walk helpers that used to live here (eachCell, spot, CELL) went with
   the rock decorations. The sky walks its own foliage along the ground line in
   biome-sky.js, and the sun is placed from the clock, so nothing else needed a
   world-space grid. */


/* --- Rock layers: deliberately bare --------------------------------------
   The dirt, stone, caves and bedrock bands used to each carry their own
   decoration pass: soil clods and ore in the dirt, coursed masonry and moss in
   the vault, stalactites and crystals in the caves, strata and book shelves in
   the bedrock.

   All of that is gone, deliberately. Those shapes made the bands read as
   separate themed layers rather than as one continuous dig, and the shelves in
   particular named their own layer out loud, which undercut the point of
   having layers at all.

   What is left is the part that actually carries the mine: the gradient, the
   scrolling grit and the jagged seam, all painted per layer in render.js. Those
   are drawn from the band geometry rather than placed as sprites, so the rock
   still has texture and still scrolls with the world - it is simply no longer
   littered with objects.

   The sky keeps its painter (biome-sky.js), because the sun and clouds are the
   one thing on the page that moves, and they are drawn from the clock rather
   than pinned to a grid cell. */

function bareBiome() { /* nothing to place: the rock is painted by render.js */ }

/* Only the sky paints anything now. The rock bands keep an entry so that the
   collar still runs and drawBiomes still reports a painted band, but the
   painter itself does nothing. */
var PAINTERS = {
  sky: skyBiome, dirt: bareBiome, stone: bareBiome,
  caves: bareBiome, bedrock: bareBiome
};

/* === The collar ========================================================
   A soft darkening immediately outside the panel, on both of its exposed
   edges. Without it the panel reads as a rectangle laid on top of the rock; with
   it the rock appears to press in around the panel, which is the whole
   difference between "a card on a background" and "a chamber cut into a
   hillside".

   Drawn OUTSIDE the panel only, because the panel is opaque and on top
   (main is z-index:10, the canvas z-index:0) - anything painted under it would
   simply be invisible. */
function collar(g, bandTop, bandBottom) {
  /* The reach is CLAMPED to the gutter's own width. It used to be a flat 26px,
     which is wider than the whole gutter on a phone: the panel spans 72..492
     with the shaft at 0..56, leaving one 16px gap, so a 26px gradient starting
     at the panel edge covered that gap completely and dimmed everything in it.

     The pixel test caught it as "a sun is drawn in the open sky" reading
     brightness 146 where it should read 252 - the sun really was painted, and
     the collar then put a 50%-black wash over all of it. Trees were dimmed the
     same way at every width; at 1440 the gutter is 598px so 26px was a
     sensible vignette and nothing looked wrong. */
  for (var n = 0; n < g.length; n++) {
    var gu = g[n];
    if (gu.w < 2) continue;
    var isLeft = (n === 0);
    var inner = isLeft ? gu.x + gu.w : gu.x;   /* the edge touching the panel */
    var outer = isLeft ? gu.x : gu.x + gu.w;
    var dir = isLeft ? -1 : 1;
    var reach = Math.min(26, gu.w);
    var grad = ctx.createLinearGradient(inner, 0, inner + dir * reach, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.50)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(Math.min(inner, outer), bandTop, reach, bandBottom - bandTop);
  }
}

/* === Entry point =======================================================
   Called by render.js once per visible band, after the gradient, the grit and
   the seam are down. Returns the number of sprites placed, which is only used
   by the smoke check to prove a biome actually drew something.

   `now` is the frame clock in ms, passed through to the painters so the ones
   that animate (the sky) can. The rock painters ignore it - they are welded to
   the world and must not swim - which is why it is an argument rather than a
   module-level clock every painter can reach. */
function drawBiomes(layer, i, bandTop, bandBottom, now) {
  var paint = PAINTERS[layer.rock];
  if (!paint) return 0;
  if (bandTop > viewH + 40 || bandBottom < -40) return 0;
  var g = gutters(layer);
  if (!g.length) return 0;                 /* no measured panel: cannot place */
  paint(g, bandTop, bandBottom, layer, i, now);
  collar(g, bandTop, bandBottom);
  return 1;
}

/* === The props pass, run AFTER every band has been painted ===============
   The z-order fix, and the reason the trees live in their own pass.

   drawBands() paints the sky band first and the dirt band second, and the dirt
   band's gradient covers everything below its top edge. The trees used to be
   drawn from inside the sky biome, so the soil was painted straight over the
   bottom of every trunk: the crowns floated above the grass line and the
   trunks were sliced off by the band edge. No amount of tuning the placement
   inside the sky painter fixes that - the painter runs too early in the frame,
   and the only thing that draws after the bands is the code that calls them.

   So the trees, bushes and their ground cover are drawn here instead, once,
   after the loop that paints the bands. Same geometry, same seed, strictly
   later in the frame. The turf and the grass tuft row stay in the sky biome:
   they are continuous terrain that belongs UNDER the props, which is exactly
   the order the user sees now.

   Returns the number of trees placed, so the smoke check can prove this pass
   actually ran rather than silently placing nothing. */
function drawSurfaceProps() {
  for (var i = 0; i < layers.length; i++) {
    if (layers[i].rock !== 'sky') continue;
    var below = layers[i + 1];
    if (!below) return 0;
    var ground = below.top - scrollY;
    /* Same gate the sky painter uses: the props stand ON the soil line, so
       there is nothing to stand on while it is off screen. */
    if (ground <= -80 || ground >= viewH + 80) return 0;
    /* meadowGutters(), NOT gutters(). The props stand on the seam at the BOTTOM
       of this band, at least half a row-gap below the panel, so the panel's
       column is not an occluder here - only the shaft is. See the note on
       meadowGutters() for the measurement that made this the right call. */
    var g = meadowGutters();
    if (!g.length) return 0;
    return skyProps(g, ground, below);
  }
  return 0;
}

/* drawBiomes, gutters and meadowGutters are this module's own. The rest are
   re-exported purely so that callers - render.js and tools/pixel-test.mjs - do
   not have to know which file a helper happens to live in after the split. */
export { drawBiomes, drawSurfaceProps, gutters, meadowGutters,
         sunSpot, scaleFor, blit, blitOn, TREE_W, TREE_GAP, TREE_SINK };
