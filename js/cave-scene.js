/* ==========================================================================
   cave-scene.js - the cave drawn as a LEVEL: depth, backdrop and the shelves
   ==========================================================================
   Everything in the cave that is not the floor itself. This exists as its own
   module for a hard reason: render.js is already at 664 lines, past its 500
   cap, so not one line of cave art may be added there. This file is the art; it
   is called from render() and owns no state that changes per frame except the
   clock it is handed.

   WHAT MAKES IT READ AS A LEVEL RATHER THAN A CORRIDOR, in four moves:

     1. PARALLAX KEYED TO THE PLAYER'S X, not the scroll. This is the single
        biggest change. A vertical page cannot scroll sideways, so the old cave
        had no parallax at all - the backdrop was a flat wash. But the player
        WALKS horizontally across the cave, so keying each layer to player.x at
        a different fraction makes the room slide behind them as they go, which
        is the whole depth trick in every 2D pixel game. Layers at 0.25 / 0.5 /
        0.75 read as far, middle and near.

     2. A BACKDROP of silhouetted pillars and arches in three depth bands, each
        darker and bluer the further back it is. Atmospheric perspective, done
        with alpha rather than with detail.

     3. LIGHT SOURCES that are not the player: torch sconces on the walls and
        crystal clusters in the rock, each with a small warm or cold pool. The
        player's lantern is no longer the only light, so the room stops reading
        as a spotlight on black.

     4. FOREGROUND silhouettes - near-black rock at the very front, drawn AFTER
        the player, plus stalactites hanging from the roof. The stalactites are
        the one piece of ceiling furniture; the roof itself is a clamp, not a
        shape, so the ceiling had nothing to hang from.

   EVERYTHING IS SEEDED from a fixed constant, so the cave is the same cave on
   every reload. A random scatter would rearrange itself mid-walk, which is the
   props-recontamination bug this repo has already paid for once.

   NO IMAGE FILES. Every shape is a gradient, a rect or a path, as everywhere
   else in this project. */
import { ctx, viewW, viewH, clamp } from './layers.js';
/* caveActive is deliberately NOT imported: every function in this file is gated by
   render.js, which calls them only inside an `if (caveActive())`. Importing it
   here to re-check would be a second gate reading the same flag, and the graph
   check rightly flags an import nothing reads. */
import { screenFloorY, caveRoof, caveRnd } from './cave.js';

/* Seeds. Fixed, never Date-based - see the header. */
var BACK_SEED = 0x0CA7E + 101;     /* backdrop pillars and arches */
var PROP_SEED = 0x0CA7E + 137;     /* crystals and torches */
var DROP_SEED = 0x0CA7E + 149;     /* stalactites */

/* The pixel-rect helper, matching render.js's. Deliberately NOT imported from
   sprites.js: that module's px() takes a context as its FIRST argument, while
   this one draws into render.js's own captured ctx. Two helpers with one name
   and different signatures is a known trap in this codebase - passing ctx as
   the first argument shifts every argument along by one and lands the colour
   string in x. This one has render.js's signature, px(x, y, w, h, colour). */
function px(x, y, w, h, colour) {
  ctx.fillStyle = colour;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/* How far each depth band slides, as a fraction of the player's x. 0 would be
   welded to the screen and 1 would not move at all relative to the player. */
var PARALLAX_FAR = 0.25;
var PARALLAX_MID = 0.50;
var PARALLAX_NEAR = 0.75;

/* A soft additive pool of light, centred on (x, y). Used by every light source
   in here so they all fall off the same curve. */
function glow(x, y, r, inner, outer) {
  var g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/* --- the backdrop: pillars in three depth bands ----------------------------
   Drawn FIRST, behind everything the cave already paints, so the floor mass
   lands on top of it and the room gains depth instead of losing it.

   Each band is a row of blocky vertical columns, placed from the player's x at
   that band's parallax fraction. That is what makes them slide at different
   speeds as the reader walks - the depth cue a vertical page cannot give. */
function drawBackdrop(px0) {
  var floor = screenFloorY(viewW * 0.5);
  if (!isFinite(floor)) return;
  var bands = [
    { par: PARALLAX_FAR,  col: '#0b1016', step: 190, w: 62, base: 0.86 },
    { par: PARALLAX_MID,  col: '#111823', step: 250, w: 78, base: 0.70 },
    { par: PARALLAX_NEAR, col: '#18202c', step: 330, w: 92, base: 0.52 }
  ];
  for (var b = 0; b < bands.length; b++) {
    var band = bands[b];
    var shift = px0 * band.par;
    var top = floor - viewH * 1.4;
    /* Each column's width and height come from the band's own generator, so a
       row is a skyline rather than a picket fence. */
    var j = caveRnd(BACK_SEED + b * 7);
    for (var x = -(((shift % band.step) + band.step) % band.step) - band.step;
         x < viewW + band.step; x += band.step) {
      var w = band.w * (0.6 + j() * 0.8);
      var h = (floor - top) * band.base * (0.45 + j() * 0.55);
      var cx = Math.round(x + j() * band.step * 0.3);
      if (h <= 0 || w <= 0) continue;
      ctx.fillStyle = band.col;
      ctx.fillRect(cx, Math.round(floor - h), Math.round(w), Math.round(h));
      /* A one-pixel lit edge on each column. Without it the near-black bands are
         unreadable as separate shapes rather than one mass. */
      px(cx + w - 1, floor - h, 1, h, 'rgba(120,150,180,0.045)');
    }
  }
}

/* --- the wall behind the floor: strata bands -------------------------------
   Horizontal bands across the cave, so the wall reads as sedimentary rock rather
   than a flat fill. A handful of rects, and it is what stops the middle of the
   screen looking empty once the floor is drawn over the bottom of it. */
function drawStrata() {
  var floor = screenFloorY(viewW * 0.5);
  if (!isFinite(floor)) return;
  var roof = caveRoof();
  var span = floor - roof;
  if (!(span > 0)) return;
  var bands = 5;
  for (var i = 0; i < bands; i++) {
    var y = roof + span * (i / bands);
    var h = Math.max(2, span * 0.035);
    /* Alternating alpha and a warm/cool shift: that is what makes rock look
       banded rather than striped. */
    var tint = (i % 2) ? '150,170,195,' : '205,180,140,';
    var a = (i % 2) ? 0.030 : 0.048;
    px(0, y, viewW, h, 'rgba(' + tint + a + ')');
  }
}
/* --- crystals: cold light in the rock --------------------------------------
   The first light source in the cave that is not the player. Seeded, so a
   cluster never rearranges itself mid-walk, and each one gets a small cold
   pool - the room stops reading as a single lantern on black. */
function drawCrystals(px0) {
  var r = caveRnd(PROP_SEED);
  var step = 300;
  var shift = px0 * PARALLAX_NEAR;
  for (var x = -(((shift % step) + step) % step) - step; x < viewW + step; x += step) {
    if (r() < 0.45) continue;                 /* not every bay has one */
    var cx = Math.round(x + r() * step * 0.5);
    var under = screenFloorY(cx);
    if (!isFinite(under)) continue;
    var h = 10 + r() * 16;
    var w = 4 + r() * 4;
    var tint = r() < 0.5 ? '150,225,255' : '190,170,255';
    /* Two or three shards, so a cluster is a shape rather than a lone spike. */
    var n = 2 + ((r() * 2) | 0);
    for (var i = 0; i < n; i++) {
      var ox = (i - n / 2) * (w * 0.9);
      var sh = h * (0.55 + r() * 0.6);
      px(cx + ox - w / 2, under - sh, w, sh, 'rgba(' + tint + ',0.30)');
      px(cx + ox - 1, under - sh, 1, sh, 'rgba(235,250,255,0.34)');
    }
    glow(cx, under - h * 0.5, 54, 'rgba(120,190,255,0.10)', 'rgba(120,190,255,0)');
  }
}

/* --- torches: warm light on the walls ---------------------------------------
   The warm counterpart to the crystals, placed high up so they light the sides of
   the room as well as the middle. The flame is the only animated thing in the
   cave and it travels two px; under reduced motion it is skipped entirely, so
   the cave is completely still for a reader who asked for that. */
function drawTorches(px0, now, reduced) {
  var step = 420;
  var shift = px0 * PARALLAX_MID;
  for (var x = -(((shift % step) + step) % step) - step; x < viewW + step; x += step) {
    var j = caveRnd(PROP_SEED + (((x / step) | 0) * 31 + 7));
    if (j() < 0.5) continue;
    var cx = Math.round(x + j() * step * 0.4);
    var under = screenFloorY(cx);
    if (!isFinite(under)) continue;
    var y = under - 70 - j() * 40;
    var flick = reduced ? 0 : Math.round(Math.sin(now / 180 + cx) * 1.5);
    /* A bracket and a stub of shaft, then the flame itself. */
    px(cx - 3, y + 6, 7, 3, 'rgba(0,0,0,0.60)');
    px(cx - 1, y + 9, 3, 10, 'rgba(0,0,0,0.45)');
    px(cx - 2, y + flick, 5, 7, 'rgba(255,190,90,0.55)');
    px(cx - 1, y + 2 + flick, 3, 5, 'rgba(255,236,190,0.65)');
    glow(cx, y + 4 + flick, 96, 'rgba(255,180,90,0.11)', 'rgba(255,180,90,0)');
  }
}

/* --- stalactites: the only ceiling furniture -------------------------------
   The cave's roof is a clamp (caveRoof()), not a shape, so it had nothing to
   hang from and the ceiling was a bare line. These are what make it a roof. */
function drawStalactites(px0) {
  var roof = caveRoof();
  if (!isFinite(roof)) return;
  var step = 120;
  var shift = px0 * PARALLAX_NEAR;
  var j = caveRnd(DROP_SEED);
  for (var x = -(((shift % step) + step) % step) - step; x < viewW + step; x += step) {
    var h = 16 + j() * 54;
    var w = 6 + j() * 12;
    var cx = Math.round(x + j() * step * 0.4);
    /* A three-step taper, which is how a stalactite reads at this pixel scale:
       blocky, and getting narrower downward. */
    px(cx - w / 2, roof, w, h * 0.45, 'rgba(10,14,19,0.92)');
    px(cx - w / 4, roof + h * 0.45, w / 2, h * 0.35, 'rgba(10,14,19,0.92)');
    px(cx - 1, roof + h * 0.80, 3, h * 0.20, 'rgba(10,14,19,0.92)');
    px(cx - w / 2, roof, 1, h * 0.45, 'rgba(150,175,200,0.07)');
  }
}


/* --- foreground silhouettes ------------------------------------------------
   Drawn AFTER the player, so the reader passes BEHIND them. Near-black masses
   at the left and right edges: the cheapest possible depth cue, and what makes a
   2D room feel like the camera is inside it rather than looking at a picture. */
function drawForegroundRocks(px0) {
  var floor = screenFloorY(viewW * 0.5);
  if (!isFinite(floor)) return;
  var j = caveRnd(DROP_SEED + 61);
  var shift = px0 * 1.15;      /* FASTER than the player: the nearest layer */
  var step = 520;
  for (var x = -(((shift % step) + step) % step) - step; x < viewW + step; x += step) {
    var cx = Math.round(x + j() * step * 0.5);
    /* The middle of the frame is left clear on purpose: that is where the player
       is, and a near-black mass across them would hide the thing being watched. */
    if (cx > viewW * 0.22 && cx < viewW * 0.78) continue;
    var under = screenFloorY(cx);
    if (!isFinite(under)) continue;
    var h = 60 + j() * 90;
    var w = 40 + j() * 60;
    px(cx - w / 2, under - h, w, h, 'rgba(4,6,9,0.96)');
    px(cx - w / 3, under - h - 14, w / 3, 14, 'rgba(4,6,9,0.96)');
  }
}

/* Public surface. Collected in one block like every other module here. */
export {
  PARALLAX_FAR,
  PARALLAX_MID,
  PARALLAX_NEAR,
  drawBackdrop,
  drawStrata,
  drawCrystals,
  drawTorches,
  drawStalactites,
  drawForegroundRocks
};
