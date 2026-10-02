/* ==========================================================================
   ==========================================================================
   The shaft already had guide rails and their joint plates (drawShaft() in
   render.js). Those are the running surface the car rides. This module adds the
   things a real shaft has around them and which the rails alone do not suggest:
   timber sets across the walls, cross-bracing between them, and the lamps that
   light the way down.

   WHY IT IS ITS OWN MODULE. render.js is past the 500-line cap already, and the
   rule here is that no new art goes into it. This is also genuinely separate
   work: the rails are MACHINE - what the car runs on, drawn at a rhythm keyed to
   the scroll - while everything here is STRUCTURE, which does not move relative
   to the page and only appears to move because the page does.

   WHY TIMBER AND NOT MORE METAL. A shaft this size would be timbered, and mixing
   a warm, grainy material against the cold grey rails gives the eye something to
   separate the two by. More grey metal would have made the shaft busier without
   making it more legible.

   EVERYTHING HERE IS DETERMINISTIC. No Math.random(): the art must be identical
   on every frame or the shaft visibly shimmers as the reader scrolls. Anything
   that looks scattered is placed from a fixed hash of its own index, the same
   way bands.js derives its seam noise, so the same brace is always in the same
   place relative to the page.

   Nothing here knows about the car, the player or the cave. It is handed the
   shaft's x range and draws only structure, so it cannot disagree with
   render.js about where the shaft is.
   ========================================================================== */

import { ctx, viewH, scrollY, mulberry32 } from './layers.js';

/* The rhythm of a timber SET - a cross-beam with its props, repeated down the
   shaft. 96px rather than the rails' 26px: sets are metres apart in a real
   shaft, and a rhythm four times longer means the two never beat against each
   other into a moire. */
var SET_STEP = 96;

/* Fixed seeds, so the scatter is stable across frames and across reloads. */
var GRAIN_SEED = 4471;
var BRACE_SEED = 8821;

/* One snapped, axis-aligned pixel rect, identical to render.js's own px().

   Duplicated rather than imported because px() is a local in render.js, and
   exporting it would mean this module importing the very file that is over its
   line cap. Snapping matters for the same reason it does there: on HiDPI an
   unsnapped fill blurs a whole pixel and the timber grain crawls. */
function px(x, y, w, h, colour) {
  ctx.fillStyle = colour;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/* A stable pseudo-random value in [0,1) from an integer. Every scattered piece of
   this art is placed with one of these, so nothing can shimmer between frames.

   THIS WAS WRONG TWICE, and both faults were invisible until a test compared two
   frames drawn a long way apart.

   The first version cached a single mulberry32 stream per seed - but only ever
   built the FIRST one, so every later call kept advancing that same generator.
   The art therefore changed on every single frame and the timber visibly hopped
   down the shaft. A cache that holds one value forever is not determinism, it is
   its opposite: it makes the result depend on how many times anything asked
   before it did.

   The second fault was operator precedence: `seed + n * C % 100000` groups as
   `(n * C) % 100000`, so the seed barely reached the result and neighbouring
   indices collided into similar values - which is why the grain clustered.

   So each index gets its OWN generator, from a seed derived from both the integer
   and the stream. No state, no dependence on call order, no cache: the same n
   gives the same value in any order in any frame. That is the property this
   needed and the property the earlier version did not have. */
function hash01(n, seed) {
  return mulberry32((seed + ((n % 100000) * 2654435761)) | 0)();
}

/* THE TIMBER SET: two wall props and the cross-beam that spans them, repeated
   down the shaft.

   The beam is drawn last and over everything, because in a real shaft the sets
   are what the guides are bolted to - so they must read as behind the rails and
   in front of the rock, or the whole thing looks like a graphic laid on top
   rather than a hole with a frame in it. */
function drawTimberSets(l, r) {
  var propW = 9;
  var off = ((scrollY % SET_STEP) + SET_STEP) % SET_STEP;
  var y, i = 0;
  for (y = -SET_STEP + off; y < viewH + SET_STEP; y += SET_STEP, i++) {
    /* A little vertical jitter per set, so they do not read as machine-perfect.
       Stable per index, so it does not shimmer. */
    var yy = y + Math.round((hash01(i, GRAIN_SEED) - 0.5) * 4);

    /* The beam: a dark plank with a lit top edge and a shadow under it. The lit
       edge is what sells it as round timber rather than a rectangle. */
    px(l + 2, yy, r - l - 4, 11, 'rgba(58,42,28,0.72)');
    px(l + 2, yy, r - l - 4, 2, 'rgba(146,110,72,0.42)');
    px(l + 2, yy + 9, r - l - 4, 2, 'rgba(0,0,0,0.32)');

    /* Grain: short darker strokes along the beam, drawn as blocks rather than
       lines so they stay crisp at this scale. */
    var k, g;
    for (k = 0; k < 3; k++) {
      g = l + 14 + Math.round(hash01(i * 3 + k, GRAIN_SEED) * Math.max(1, (r - l - 34)));
      px(g, yy + 3 + k, 7 + Math.round(hash01(i + k, GRAIN_SEED) * 9), 1,
         'rgba(0,0,0,0.22)');
    }

    /* The props - the uprights the beam bears against. Under the beam's own
       face, so they read as going behind it rather than being painted on. */
    px(l + 3, yy + 11, propW, SET_STEP - 11, 'rgba(50,36,24,0.60)');
    px(r - 3 - propW, yy + 11, propW, SET_STEP - 11, 'rgba(50,36,24,0.60)');
    px(l + 3, yy + 11, 2, SET_STEP - 11, 'rgba(132,98,64,0.26)');
    px(r - 3 - propW, yy + 11, 2, SET_STEP - 11, 'rgba(132,98,64,0.18)');
  }
}

/* CROSS-BRACING between one set and the next: a diagonal on each side, so the
   shaft reads as a structure resisting something rather than a bare corridor.

   Drawn as a staircase of short blocks rather than a real diagonal. A stroked
   line would be antialiased and would shimmer against the pixel-art timber -
   the same reason the sheave wheel in drawHoist() is three stacked bars rather
   than an arc. */
function drawBracing(l, r) {
  var span = SET_STEP - 14;
  var steps = 7;
  var off = ((scrollY % SET_STEP) + SET_STEP) % SET_STEP;
  var base, i, k;
  for (base = -SET_STEP + off; base < viewH + SET_STEP; base += SET_STEP) {
    for (i = 0; i < 2; i++) {
      /* Half the bays are braced and half are not, by a stable hash, so the
         pattern has gaps in it rather than reading as wallpaper. */
      if (hash01(base + i, BRACE_SEED) < 0.45) continue;
      for (k = 0; k < steps; k++) {
        var t = k / (steps - 1);
        var yy = base + 12 + t * span;
        var reach = Math.max(0, (r - l - 30) * 0.34);
        var x = i === 0 ? l + 12 + t * reach : r - 21 - t * reach;
        px(x, yy, 7, 2, 'rgba(70,52,34,0.42)');
      }
    }
  }
}

/* THE LAMPS. One every other set, alternating walls, each with a warm pool of
   light on the rock beside it.

   The pool is the point. Without it these are two bright dots in a dark
   rectangle; with it the shaft has depth and the eye is led downward, which is
   what makes the shaft read as going somewhere rather than as a panel.

   There is no flicker and no clock here. An earlier draft flickered on a timer,
   which is animation played at the reader rather than response to what they did -
   the exact thing the reduced-motion rule rules out. Tying it to scrollY instead
   would mean it holds perfectly still when the reader does, which is the promise
   actually being kept here. */
function drawShaftLamps(l, r) {
  var off = ((scrollY % (SET_STEP * 2)) + SET_STEP * 2) % (SET_STEP * 2);
  var i = 0, y;
  for (y = -SET_STEP * 2 + off; y < viewH + SET_STEP * 2; y += SET_STEP * 2, i++) {
    /* Alternate walls, and skip roughly one in four, so the lamps are not a
       metronome down the shaft. */
    if (hash01(i, GRAIN_SEED + 13) < 0.24) continue;
    var lx = hash01(i, GRAIN_SEED + 29) < 0.5 ? l + 8 : r - 8;
    var ly = y + SET_STEP;

    /* Pool of light on the rock, falling off upward. Four blocks, widest at the
       bottom, so it reads as a gradient without paying for one. */
    px(lx - 16, ly - 6, 32, 3, 'rgba(255,210,120,0.045)');
    px(lx - 13, ly - 3, 26, 4, 'rgba(255,210,120,0.055)');
    px(lx - 10, ly + 1, 20, 4, 'rgba(255,210,120,0.05)');
    px(lx - 6,  ly + 5, 12, 3, 'rgba(255,210,120,0.035)');

    /* The lamp itself: a bracket, a glass body, and a hot core. */
    px(lx - 1, ly - 3, 2, 2, 'rgba(20,16,12,0.75)');
    px(lx - 3, ly - 1, 6, 6, 'rgba(28,22,16,0.85)');
    px(lx - 2, ly, 4, 4, 'rgba(255,226,150,0.80)');
    px(lx - 1, ly + 1, 2, 2, 'rgba(255,248,214,0.92)');
  }
}

/* Public surface, in one block like every other module here so smoke.mjs's
   export check can read it. */
export {
  drawTimberSets,
  drawBracing,
  drawShaftLamps,
  SET_STEP
};
