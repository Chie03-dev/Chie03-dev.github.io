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
import { reduced } from './deck.js';
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
function gutters(layer) {
  if (!layer || !isFinite(layer.left) || !isFinite(layer.width)) return [];
  var pl = layer.left, pr = layer.left + layer.width;
  var sl = shaftLeft(), sr = shaftRight();
  var raw;
  if (pr <= sl) raw = [{ x: 0, w: pl }, { x: pr, w: sl - pr }];
  else if (pl >= sr) raw = [{ x: sr, w: pl - sr }, { x: pr, w: viewW - pr }];
  else return [];                        /* spans the shaft: nothing visible */

  /* Clip to the viewport and drop anything with no room left. Without this a
     panel wider than a narrow window yields a NEGATIVE width, and a negative
     width is a silent no-op in fillRect - the art would simply not appear and
     nothing would report it. */
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var x = raw[i].x, w = Math.min(raw[i].w, viewW - x);
    if (w > 4 && x < viewW) out.push({ x: x, w: w });
  }
  return out;
}

/* Blit a baked sprite at an integer scale, choosing the largest scale that
   still fits the gutter. Integer scaling is what keeps the pixel art crisp;
   a fractional scale would blur every edge, which is the one thing this art
   must never do. */
function blit(spr, x, y, room) {
  if (!spr) return;
  var k = Math.max(1, Math.min(2, Math.floor(room / spr.width) || 1));
  ctx.drawImage(spr, Math.round(x), Math.round(y),
                spr.width * k, spr.height * k);
}


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

/* --- 1. Sky: the surface camp ------------------------------------------
   The only layer with weather in it. A grass line runs across the gutters at
   a fixed fraction of the band, soil sits below it, and the trees and flowers
   stand ON it - so a vertical slice of this gutter reads as a landscape with a
   horizon, rather than as decoration scattered over a blue field. */
function skyBiome(g, bandTop, bandBottom) {
  var ground = bandTop + (bandBottom - bandTop) * 0.74;
  var drift = reduced ? 0 : (scrollY * 0.10) % 300;
  var n, gu, c, cy, rnd, x;

  for (n = 0; n < g.length; n++) {
    gu = g[n];
    if (gu.w < 16) continue;

    /* Soil below the horizon, so the band does not simply stop being sky. */
    if (ground < viewH + 40) {
      px(ctx, gu.x, ground, gu.w, Math.max(0, viewH + 40 - ground), 'rgba(74,46,28,0.55)');
      px(ctx, gu.x, ground, gu.w, 2, '#5c8a3a');            /* the turf mat  */
      px(ctx, gu.x, ground, gu.w, 1, '#8fd06a');            /* lit top edge */
    }

    eachCell(bandTop, bandBottom, 0, function (cell, top, r) {
      /* Clouds drift slowly and sit well above the horizon. */
      if (r() < 0.34) {
        var cw = 26 + ((r() * 30) | 0), ch = 7 + ((r() * 5) | 0);
        var cx = gu.x + ((r() * (gu.w + cw)) | 0) - cw - drift;
        px(ctx, cx, top + 6, cw, ch, 'rgba(255,255,255,0.55)');
        px(ctx, cx + 6, top + 3, cw - 14, 4, 'rgba(255,255,255,0.55)');
        px(ctx, cx + 3, top + ch + 4, cw - 8, 2, 'rgba(255,255,255,0.22)');
      }
      /* A tree standing on the turf. */
      if (r() < 0.62 && ground > -30 && ground < viewH + 30) {
        var conifer = r() < 0.62;
        var spr = conifer
          ? SET.conifers[(r() * SET.conifers.length) | 0]
          : SET.canopies[(r() * SET.canopies.length) | 0];
        blit(spr, spot(gu, r, spr.width), ground - spr.height * 2 + 1, gu.w);
      }
      /* Grass tufts and flowers, along the same line. */
      if (ground > -20 && ground < viewH + 20) {
        blit(SET.tufts[(r() * SET.tufts.length) | 0], spot(gu, r, 9), ground - 6, gu.w);
        if (r() < 0.75) {
          var bed = SET.blooms[(r() * SET.blooms.length) | 0];
          var f = bed[(r() * bed.length) | 0];
          blit(f, spot(gu, r, 7), ground - f.height * 2 + 1, gu.w);
        }
      }
    });
  }
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
  var reach = 26;
  for (var n = 0; n < g.length; n++) {
    var gu = g[n];
    if (gu.w < 2) continue;
    var isLeft = (n === 0);
    var inner = isLeft ? gu.x + gu.w : gu.x;   /* the edge touching the panel */
    var outer = isLeft ? gu.x : gu.x + gu.w;
    var dir = isLeft ? -1 : 1;
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
   by the smoke check to prove a biome actually drew something. */
function drawBiomes(layer, i, bandTop, bandBottom) {
  var paint = PAINTERS[layer.rock];
  if (!paint) return 0;
  if (bandTop > viewH + 40 || bandBottom < -40) return 0;
  var g = gutters(layer);
  if (!g.length) return 0;                 /* no measured panel: cannot place */
  paint(g, bandTop, bandBottom);
  collar(g, bandTop, bandBottom);
  return 1;
}

export { drawBiomes, gutters };
