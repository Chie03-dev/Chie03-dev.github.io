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

import {
  ctx, viewW, viewH, scrollY, shaftLeft, shaftRight, mulberry32
} from './layers.js';
import { SET, px } from './sprites.js';

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
import { skyBiome, sunSpot } from './biome-sky.js';
import { scaleFor, blit, blitOn } from './place.js';


/* === The five biomes ====================================================
   Each painter receives the band in SCREEN space plus the gutters, and places
   its own shapes. Placement is driven by a world-space cell index, so a sprite
   is nailed to a spot in the document and does not swim or flicker as the
   reader scrolls - the same rule the old motifs used, kept because it works. */

var CELL = 74;   /* vertical rhythm of the placement grid, in document px */

/* Walk the cells that intersect this band and hand each one to `place`,
   along with a seeded rng. Scoped per biome so two biomes sharing a cell
   boundary cannot place on top of each other. */
function eachCell(bandTop, bandBottom, i, place) {
  var worldTop = bandTop + scrollY;                 /* document Y of the band */
  /* bandBottom - bandTop is the band HEIGHT in screen space, and scrollY has
     already been added once into worldTop. Adding it a second time here
     inflated `last` by scrollY/CELL - about 95 extra cells per band per frame
     on a long page, so it quietly multiplied the per-frame sprite count. */
  var bandH = bandBottom - bandTop;
  var first = Math.floor(worldTop / CELL) - 1;
  var last = Math.ceil((worldTop + bandH) / CELL) + 1;
  for (var c = first; c <= last; c++) {
    var cy = c * CELL - scrollY;                 /* cell top, screen space */
    if (cy > viewH + 60 || cy + CELL < -60) continue;
    place(c, cy, mulberry32(c * 2654435761 + i * 40503 + 7));
  }
}

/* A position inside a gutter. `room` is the gutter width, and every caller
   passes it to blit() so a shape is shrunk rather than allowed to spill over
   the panel edge it is meant to be framing. */
function spot(gu, rnd, reserve) {
  var room = Math.max(1, gu.w - (reserve || 0));
  return gu.x + ((rnd() * room) | 0);
}


/* --- 2. Dirt: the ore mine ---------------------------------------------
   Soil clods, a seam of exposed gold, and roots coming down out of the turf
   above. The roots are the continuity cue: they tie this band to the surface
   instead of leaving it as unrelated brown. */
function dirtBiome(g, bandTop, bandBottom) {
  for (var n = 0; n < g.length; n++) {
    var gu = g[n];
    if (gu.w < 10) continue;
    eachCell(bandTop, bandBottom, 1, function (cell, cy, r) {
      var x = spot(gu, r, 10);
      if (r() < 0.85) blit(SET.soil[(r() * SET.soil.length) | 0], x, cy, gu.w);
      if (r() < 0.30) blit(SET.ore[(r() * SET.ore.length) | 0], x, cy + 14, gu.w);
      if (r() < 0.22) blit(SET.roots[(r() * SET.roots.length) | 0], x, cy - 4, gu.w);
    });
  }
}

/* --- 3. Stone: the treasure vault --------------------------------------
   Coursed masonry rather than a rock face. This is the one biome that is
   clearly BUILT, which is what separates the vault from the mine above and the
   caves below; the moss is what stops it looking like a diagram. */
function stoneBiome(g, bandTop, bandBottom) {
  for (var n = 0; n < g.length; n++) {
    var gu = g[n];
    if (gu.w < 10) continue;
    eachCell(bandTop, bandBottom, 2, function (cell, cy, r) {
      /* Stagger alternate courses, or the mortar lines line up into a grid. */
      var x = gu.x + (cell % 2) * 9 - 9;
      while (x < gu.x + gu.w) {
        blit(SET.blocks[(r() * SET.blocks.length) | 0], x, cy, gu.w);
        x += 17;
      }
      if (r() < 0.34) blit(SET.moss[0], spot(gu, r, 10), cy + 30, gu.w);
      if (r() < 0.22) blit(SET.ore[(r() * SET.ore.length) | 0], spot(gu, r, 8), cy + 46, gu.w);
    });
  }
}


/* --- 4. Caves: the dungeon halls ---------------------------------------
   The ceiling and the floor grow towards each other: spikes hang from the top
   of each cell and rise from the bottom of the next. The crystals are the only
   cold, bright thing in the whole dig, which is what stops this band reading
   as "more dark rock" - the palette, not the shape, is doing the work. */
function cavesBiome(g, bandTop, bandBottom) {
  for (var n = 0; n < g.length; n++) {
    var gu = g[n];
    if (gu.w < 10) continue;
    eachCell(bandTop, bandBottom, 3, function (cell, cy, r) {
      if (r() < 0.55) {
        blit(SET.spikesDown[(r() * SET.spikesDown.length) | 0],
             spot(gu, r, 8), cy - 6, gu.w);
      }
      if (r() < 0.45) {
        blit(SET.spikesUp[(r() * SET.spikesUp.length) | 0],
             spot(gu, r, 8), cy + CELL - 8, gu.w);
      }
      if (r() < 0.40) {
        blit(SET.crystals[(r() * SET.crystals.length) | 0],
             spot(gu, r, 9), cy + 18, gu.w);
      }
    });
  }
}

/* --- 5. Bedrock: the ancient library, and the treasure room ------------
   The deepest rock is the warmest, not the darkest: near-black strata with an
   amber vein, because this is the bottom of the dig and the resume is down
   here. The bookshelf rows are the one motif in the project that names its own
   layer without a word of copy. */
function bedrockBiome(g, bandTop, bandBottom) {
  for (var n = 0; n < g.length; n++) {
    var gu = g[n];
    if (gu.w < 10) continue;
    eachCell(bandTop, bandBottom, 4, function (cell, cy, r) {
      var x = gu.x + (cell % 2) * 10 - 10;
      while (x < gu.x + gu.w) {
        blit(SET.strata[(r() * SET.strata.length) | 0], x, cy, gu.w);
        x += 19;
      }
      if (r() < 0.50) blit(SET.shelves[(r() * SET.shelves.length) | 0], spot(gu, r, 15), cy + 26, gu.w);
      if (r() < 0.30) blit(SET.nuggets[0], spot(gu, r, 9), cy + 52, gu.w);
    });
  }
}

var PAINTERS = {
  sky: skyBiome, dirt: dirtBiome, stone: stoneBiome,
  caves: cavesBiome, bedrock: bedrockBiome
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

/* drawBiomes and gutters are this module's own. The three are re-exported purely
   so that callers - render.js and tools/pixel-test.mjs - do not have to know
   which file a helper happens to live in after the split. */
export { drawBiomes, gutters, sunSpot, scaleFor, blit, blitOn };
