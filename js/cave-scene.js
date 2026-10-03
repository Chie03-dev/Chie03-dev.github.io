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
/* caveActive() is imported because drawCave() - which moved here from render.js -
   gates ITSELF on it, exactly as it always did. The backdrop functions above are
   still gated by their caller and do not re-check, which is the point: one gate
   per draw, not two reading the same flag.

   The drawing constants arrive here with the art that uses them, which is why they
   are no longer imported by render.js. */
import { screenFloorY, caveRoof, caveRnd, caveActive,
         CAVE_FLOOR_STEP, CAVE_RUBBLE_SEED, CAVE_VEIN_SEED } from './cave.js';
/* player, for the lantern in drawCaveLight(). The one thing the moved cave art
   needed from render.js, and it comes from where it lives rather than being
   passed down - a parameter on every call for one number is worse. */
import { player } from './game.js';
/* The cage's own numbers, for the drawing that moved here from render.js. They
   come from the same functions the collision reads, so the plate the player is
   resolved against and the plate that is painted cannot be two different lines. */
import { cageActive, cageFloorY, cageSpan } from './cage.js';

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

/* === The bedrock cave =====================================================
   Drawn only while the player is actually in it (caveActive()), and drawn
   BEFORE the hoist and the player so the sprite stands on top of the floor
   rather than behind it.

   The floor is one polyline sampled at the same FLOOR_STEP the collision uses,
   which is what keeps the art and the physics reading one curve. Two consumers
   of a profile that disagreed about where to sample it is precisely the bug that
   made the meadow twitch, so it is worth being explicit that this loop and
   movePlayerCave() walk the same numbers.

   Three passes, back to front: the dark void, the rock mass below the floor
   line, then the lit detail - rubble catching the torchlight, and the ore veins.
   Detail is drawn AFTER the mass so it is not buried by it. */
/* THE VOID IS GONE, and that is the whole change.

   It used to paint an opaque #05070a -> #12171e gradient across the entire cave
   the moment caveActive() became true, which meant the DUNGEON BAND behind the
   cave - the rock biome every other layer is made of, and the one the sixth room
   is explicitly built from - was replaced the instant you entered the final
   layer. Entering the cave did not take you deeper into the same world; it
   swapped one world for another laid on top.

   So nothing is filled here any more. The band's own rock is what shows through
   the cave, and cave-scene.js draws its parallax backdrop, strata, crystals,
   torches and stalactites ON TOP of that band - which is exactly how every
   other layer's biome art works. The cave is now a room in the same world with
   the same rock, seen from the inside, rather than a separate world painted over
   the page.

   `caveActive()` is deliberately NOT imported: render.js already gates every
   call to this on it, and re-checking a second flag here would be a second gate
   reading the same thing. */
function drawCaveVoid() {
  /* Intentionally empty - see the comment above. Kept as a function rather than
     deleted at the call site so the render order still reads in one place, and
     so restoring a fill is one line here rather than a hunt through render(). */
}

function drawCave() {
  if (!caveActive()) return;

  /* The viewport width is the fallback, NOT window.innerWidth directly. The smoke
     harness drives the stub and innerWidth is 0 there for part of the run, and
     with w = 0 the sample loop below never executes, pts stays empty, and the
     first pts[0] read throws - which took render() down at three viewports. A
     cave that cannot be measured is a cave with nothing to draw, not a crash. */
  var w = viewW || window.innerWidth || 0;
  if (!(w > 0)) return;
  var step = CAVE_FLOOR_STEP;
  var pts = [], x;
  /* One extra step past the right edge, so the last segment reaches the edge
     rather than stopping short of it and leaving a gap of bare band. */
  for (x = 0; x <= w + step; x += step) {
    pts.push([x, screenFloorY(x)]);
  }
  if (pts.length < 2) return;

  /* How far the rock mass extends below the floor. Sized to the VIEWPORT rather
     than a fixed 400: the player is clamped into the cave's bounds and stood on
     this floor, and a mass that stopped short of the bottom of a tall window
     would leave them standing on the edge of nothing. */
  var deep = Math.max(viewH || 0, 400);


  /* --- the rock mass below the floor line --- */
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineTo(w + step, pts[pts.length - 1][1] + deep);
  ctx.lineTo(-step, pts[0][1] + deep);
  ctx.closePath();
  var rockGrad = ctx.createLinearGradient(0, pts[0][1], 0, pts[0][1] + 260);
  rockGrad.addColorStop(0, '#3a4450');
  rockGrad.addColorStop(0.35, '#232a33');
  rockGrad.addColorStop(1, '#0b0e12');
  ctx.fillStyle = rockGrad;
  ctx.fill();

  /* The lit top edge of the floor. One pixel of warm light along the line the
     player walks on is what sells the floor as a surface catching a torch,
     rather than as the boundary of a fill. */
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = 'rgba(196,214,236,0.20)';
  ctx.lineWidth = 2;
  ctx.stroke();

  /* --- rubble on the floor, at the profile's own steps --- */
  var r = caveRnd(CAVE_RUBBLE_SEED);
  for (i = 0; i < pts.length; i++) {
    if (i % 2) continue;                       /* every other step: half as many */
    /* bx/by, NOT px/py: `px` is the drawing helper imported from sprites.js, and
       a local var of the same name shadows it for the whole function - so the
       first rubble block would have called a number. */
    var bx = pts[i][0], by = pts[i][1];
    var rw = 5 + ((r() * 16) | 0);
    var rh = 3 + ((r() * 7) | 0);
    var lit = 0.10 + r() * 0.16;
    /* px() HERE is render.js's own five-argument helper - px(x, y, w, h, colour),
       which draws into the module's own ctx and does NOT take a context as its
       first argument. sprites.js has a second helper with the same name and a
       different signature, px(g, x, y, w, h, colour), which does. Passing ctx as
       the first argument here shifted every argument along by one, so the colour
       string landed in x and Math.round("rgba(...)") produced the NaN that the
       non-finite check caught. The two helpers sharing a name is the real hazard
       in this codebase; the smoke test's finite() reporting on fillRect is what
       turned a silently missing room into a named failure. */
    px(bx - rw / 2, by - rh, rw, rh, 'rgba(18,22,28,0.85)');
    px(bx - rw / 2, by - rh, rw, 1, 'rgba(190,206,226,' + lit.toFixed(3) + ')');
  }

  /* --- ore veins in the rock face, below the floor line --- */
  for (i = 0; i < pts.length; i += 3) {
    var pick = caveRnd(CAVE_VEIN_SEED + i);
    if (((pick() * 3) | 0) !== 0) continue;
    var vx = pts[i][0] + 20, vy = pts[i][1] + 26 + ((pick() * 90) | 0);
    var vw = 3 + ((pick() * 9) | 0);
    px(vx, vy, vw, 2, 'rgba(246,201,109,0.16)');
  }
}

/* The cave floor the player is standing on, lit by their lantern. Drawn after
   the mass so the pool of light lands on the rock rather than under it. */
function drawCaveLight() {
  if (!caveActive()) return;
  var cx = player.x + player.w / 2;
  var cy = screenFloorY(cx);
  var g = ctx.createRadialGradient(cx, cy, 6, cx, cy, 190);
  g.addColorStop(0, 'rgba(255,206,122,0.17)');
  g.addColorStop(0.55, 'rgba(255,190,110,0.06)');
  g.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - 190, cy - 190, 380, 380);
}


/* === The cage at the foot of the shaft ====================================
   Moved here from render.js. It is drawn from cageFloorY() - the collision's own
   number - so the painted lip is exactly the line the player is resolved against.
   Two consumers of one fact that disagree is the seam twitch all over again. */
   /* === The cage at the foot of the shaft ====================================
   Moved here from render.js. It is an open steel frame, not a box: four corner
   posts, a lattice of bars on
   the back and sides, a solid plate to stand on, and a pair of guide shoes
   where the cage would meet the shaft's rails. Nothing here is a filled
   rectangle across the opening, because the player is meant to walk in under it
   and a solid back would hide them.

   Every Y is read from cageFloorY() - the collision's own number - so the
   painted lip is exactly the line the player is resolved against. That shared
   number is the same arrangement drawCar() has with groundY(), and for the same
   reason: two consumers of one fact that disagree is the seam twitch all over
   again. */
function drawCage() {
  if (!caveActive() || !cageActive()) return;
  var plate = cageFloorY();
  if (!isFinite(plate)) return;
  var s = cageSpan();

  /* Posts: the frame's four corners, standing from the plate down to whatever
     the floor happens to be beneath. The floor is sampled per post rather than
     assumed flat, so the cage is planted on the rock instead of hovering over
     the low point - which is exactly the failure the cage's own floor
     calculation exists to prevent, reproduced here if the two disagreed. */
  var postW = 5, inset = 3;
  var l = s.left + inset, r = s.right - inset - postW;
  var x, floorY;
  for (x = 0; x < 2; x++) {
    var postX = (x === 0) ? l : r;
    floorY = screenFloorY(postX + postW / 2);
    if (!isFinite(floorY) || floorY < plate) floorY = plate + 40;
    var len = floorY - plate;
    if (len > 0) {
      px(postX, plate, postW, len, 'rgba(12,16,21,0.88)');
      /* One lit edge per post, so the frame has a front face. */
      px(postX, plate, 1, len, 'rgba(255,255,255,0.13)');
      px(postX + postW - 1, plate, 1, len, 'rgba(0,0,0,0.45)');
    }
  }

  /* Back lattice: vertical bars at a fixed rhythm between the posts, and one
     horizontal rail a third of the way up. Sparse on purpose - the point is to
     read as a cage you can see through, and this is what lets the player behind
     it stay visible. */
  var top = plate - 3 - 34;
  var bar;
  for (bar = l + 8; bar < r; bar += 11) {
    px(bar, top, 2, 34, 'rgba(255,255,255,0.055)');
  }
  px(l, top + 16, r - l, 2, 'rgba(255,255,255,0.075)');

  /* The plate itself. The lit lip is drawn AT EXACTLY plate, the Y
     movePlayerCage() resolves against. */
  px(l - inset, plate, (r + postW) - l + inset * 2, 2, 'rgba(255,210,74,0.26)');
  px(l - inset, plate + 2, (r + postW) - l + inset * 2, 5, 'rgba(0,0,0,0.78)');
  px(l - inset, plate + 2, (r + postW) - l + inset * 2, 1, 'rgba(255,255,255,0.12)');
  /* Rivets, so the plate has a face rather than being a bar. */
  for (var rivet = l - inset + 4; rivet < r; rivet += 9) {
    px(rivet, plate + 4, 1, 1, 'rgba(255,255,255,0.10)');
  }

  /* Guide shoes, where the cage meets the shaft rails above it - the detail
     that ties this structure to drawCar()'s shoes and makes the two read as the
     same machine at two ends of its travel. */
  px(l - 2, plate - 5, 7, 5, 'rgba(0,0,0,0.70)');
  px(r - 5, plate - 5, 7, 5, 'rgba(0,0,0,0.70)');
  px(l - 1, plate - 4, 5, 1, 'rgba(255,255,255,0.12)');
  px(r - 4, plate - 4, 5, 1, 'rgba(255,255,255,0.12)');
}

export {
  PARALLAX_FAR,
  PARALLAX_MID,
  PARALLAX_NEAR,
  drawBackdrop,
  drawStrata,
  drawCrystals,
  drawTorches,
  drawStalactites,
  drawForegroundRocks,
  drawCave,
  drawCaveLight,
  drawCaveVoid,
  drawCage
};
