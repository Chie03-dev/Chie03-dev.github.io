/* ==========================================================================
   Biome 1 of 5: the sky, and the surface camp below it.

   Split out of biomes.js purely to keep that file readable - the sky is by far
   the biggest painter, and it is also the only one that MOVES on its own. The
   sun arcs and the clouds drift, both driven by the same clock, which is frozen
   at zero under prefers-reduced-motion.

   Everything time-based here is a function of that one `clock` value. That is
   what makes "the sky animates" a single switch rather than a hunt through the
   painter, and it is why the pixel test can ask sunSpot() where the sun should
   be and check the pixels there.

   Placement helpers come from place.js; the panel geometry arrives as `g`, the
   measured gutters, so nothing is ever drawn where the opaque panel would hide
   it.
   ========================================================================== */

import {
  ctx, viewW, viewH, scrollY, mulberry32, layers, seamY, seamPropY, SEAM_STEP
} from './layers.js';
import { reduced } from './deck.js';
import { SET, px } from './sprites.js';
import { scaleFor, blitOn } from './place.js';

/* --- 1. Sky: the surface camp ------------------------------------------
   The horizon is NOT a fraction of this band. It is the top seam of the layer
   BELOW - the exact line render.js already strokes as the grass edge - so the
   surface the trees stand on is the same surface the soil starts under.

   The old code put the ground at 74% of the sky band. On the real layout that
   is y=536, while the actual seam is y=764: the turf floated 228px above the
   soil it was supposed to cap, with bare page background in between. That is
   the "surface not sitting on the soil" bug, and no amount of extra art hides
   it.

   Two rules make the framing read:
     - CONTINUOUS terrain (sky wash, hills, turf, grass) is painted full width.
       It is a background, and a background with a gap beside the panel looks
       broken rather than framed.
     - DISCRETE props (trees, tufts, flowers) go in the gutters only, because a
       tree hidden under an opaque panel is a tree that was never drawn.

   The surface is placed against the UNJITTERED top of the layer below, not
   against its ragged seam. drawBands() paints the bands in order, so the dirt
   band's gradient is laid down after this one and covers everything below its
   top edge; turf drawn along the jittered curve was therefore half-buried by
   the soil it was meant to sit on. render.js already strokes that ragged seam
   in grass green, so meeting it flush here lets the two read as one edge. */
/* The narrowest gutter the sun will be drawn into.
   This was 44px, which was a guess, and the pixel test proved it wrong: on a
   phone the panel fills the width and the only gutter measures 16px, so the sky
   got NO sun at all at 360 and 821 - the two widths most people actually use.

   14px is the real floor: a 12px disc plus a 1px margin at each side. Below
   that the sun is smaller than the gutter noise and reads as a speck rather
   than a sun, so it is genuinely not drawn - but 16px clears the bar, and a
   phone gets a sun. */
var SUN_MIN_GUTTER = 14;

/* Where the sun is, for a given gutter set and clock.
   Exported so the pixel test can ask WHERE the sun should be and then check
   the pixels there, instead of trying to recognise a warm blob in the output.

   That distinction matters more than it sounds. Sniffing for the sun in pixels
   failed for a long time here: flowers, grass and the sun are all warm, the
   glow bleeds across the shaft, and a 4px disc over a blue sky is not
   separable by any threshold that did not also match everything else. Asking
   the painter where it is going to put the sun, and then verifying that
   position really does change and really is in open sky, tests the thing that
   is actually claimed - and cannot be fooled by a yellow flower.

   `drawn:false` means the visible gutters are too narrow for a sun at all. */
function sunSpot(g, clock, bandTop) {
  var openSky = null, bestRoom = 0, q;
  for (q = 0; q < g.length; q++) {
    if (g[q].w > bestRoom) { bestRoom = g[q].w; openSky = g[q]; }
  }
  if (!openSky || openSky.w < SUN_MIN_GUTTER) {
    return { drawn: false, x: -1, y: -1, r: 0, gutter: openSky };
  }
  /* Horizontal: a 96 second arc, slow enough to be ambience rather than
     something the eye tracks. */
  var arc = Math.sin(clock * 0.0654) * 0.5 + 0.5;
  /* The disc is sized to the space it has and then travels within the rest. On
     a phone the panel fills the width and the one gutter is about 16px, so the
     sun is small and CENTRED, and the vertical arc is the only thing that
     moves it. A small sun pinned hard against a gutter edge reads as a
     rendering artefact; a small centred one with a soft glow reads as a
     distant sun. */
  var r = Math.max(4, Math.min(16, Math.floor((openSky.w - 8) / 2)));
  var travel = Math.max(0, openSky.w - r * 2 - 6);
  var x = travel > 0 ? (openSky.x + r + 3 + arc * travel) : openSky.x + openSky.w / 2;
  /* Vertical: a DIFFERENT period from the horizontal one (73s against 96s).
     Sharing one period made the sun track a near-perfect diagonal, which reads
     as mechanical, and it also let two samples land on the same row. The arc
     scales with the disc so a small sun still makes a visible climb. */
  var y = bandTop + 58 + Math.sin(clock * 0.0861) * (14 + r);
  return { drawn: true, x: x, y: y, r: r, gutter: openSky };
}

function skyBiome(g, bandTop, bandBottom, layer, i, now) {
  var below = layers[i + 1];
  if (!below) return;                       /* nothing below: sky only */
  var ground = below.top - scrollY;         /* the real soil line */
  /* Bail only if NOTHING this biome draws can be on screen.

     It used to bail whenever the soil line was below the fold:
         if (ground < -80 || ground > viewH + 80) return;
     and that threw away the sky itself. At 360x740 the soil line sits at y=771
     in a 648px viewport - 123px below the bottom - so the whole early return
     fired and the surface drew NO sun and NO clouds at all. The sun and the
     clouds live near the TOP of the band, at bandTop, so they are plainly
     visible while the soil line is off screen; that is the NORMAL case on a
     phone, not an edge case.

     The band being on screen is the real precondition, and drawBiomes() already
     checks that. So the sun and clouds are no longer gated on the ground, and
     only the turf and props pass below is - they genuinely cannot draw above the
     soil line, so skipping them when it is off screen is correct. */
  var surfaceVisible = ground > -80 && ground < viewH + 80;
  var r = mulberry32(0x5EA51DE);

  /* Elapsed seconds, frozen at 0 under reduced motion. Every moving thing in
     this biome is a function of THIS number, which is what makes "the sky
     animates" a single switch rather than a hunt through the painter. `now` is
     the rAF timestamp in ms; the smoke harness supplies a real number too, so
     the guard is belt-and-braces rather than a papering-over of undefined. */
  var clock = reduced ? 0 : (isFinite(now) ? now / 1000 : 0);

  /* --- Sky, carried down to the ground ---------------------------------
     The band gradient stops at this layer's bottom edge, but the ground is at
     the NEXT layer's top, and the gap between the two showed the bare page
     background: a dark strip across the full width. Extending the wash to the
     ground closes it, so sky meets soil with no seam of nothing between. */
  var wash = ctx.createLinearGradient(0, bandTop, 0, ground);
  wash.addColorStop(0, '#3f9fd6');
  wash.addColorStop(0.55, '#8ecbe8');
  wash.addColorStop(1, '#d8eff9');
  ctx.fillStyle = wash;
  ctx.fillRect(-40, bandTop - 2, viewW + 80, ground - bandTop + 2);

  /* --- Sun: low and warm, sitting in the open sky ---------------------- */
  /* --- Sun: low, warm, and slowly arcing across the open sky --------------
     It used to sit at a fixed viewW*0.76 and never moved at all. Worse, on a
     desktop layout that column is inside the shaft corridor, so a glowing disc
     was being painted straight over the mine.

     It now arcs on a long period, and - the part that actually mattered - it
     arcs WITHIN THE WIDEST GUTTER. The panel is opaque and sits on top, so a
     sun at any x under the panel is a sun nobody ever sees. My first attempt
     only pushed it clear of the SHAFT, which parked it at x=388: a 48px slot
     between the panel edge and the shaft, i.e. still hidden.

     The maths lives in sunSpot() above, shared with the pixel test so both
     agree on where the sun is meant to be. */
  var sun = sunSpot(g, clock, bandTop);
  if (sun.drawn) {
    var sunX = sun.x, sunY = sun.y, sunR = sun.r;
    var glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    glow.addColorStop(0, 'rgba(255,250,214,0.90)');
    glow.addColorStop(0.22, 'rgba(255,236,160,0.40)');
    glow.addColorStop(1, 'rgba(255,236,160,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
    /* The disc is OPAQUE, and that matters at small sizes. It was 0.95 alpha,
       which on a 32px desktop sun is indistinguishable from solid but on an 8px
       phone sun leaves the centre blended with the blue sky: the pixel test
       measured brightness 140 at 821 against 196 at 1440, and a fixed
       "is the sun bright" threshold then failed at exactly the widths where the
       sun is hardest to see. An 8px disc is small enough that a soft edge eats
       most of it. */
    px(ctx, sunX - sunR, sunY - sunR, sunR * 2, sunR * 2, 'rgb(255,252,226)');
  }

  /* --- Two ranges of distant hills, so the horizon has depth ----------- */
  for (var pass = 0; pass < 2; pass++) {
    var far = pass === 0;
    var ridge = ground - (far ? 82 : 48);
    var amp = far ? 18 : 12;
    ctx.beginPath();
    ctx.moveTo(-40, ground);
    for (var x = -40; x <= viewW + 40; x += 10) {
      var wob = Math.sin((x + pass * 90) / (far ? 155 : 98)) * amp
              + Math.sin((x + pass * 37) / 49) * (amp * 0.34);
      ctx.lineTo(x, ridge - wob);
    }
    ctx.lineTo(viewW + 40, ground);
    ctx.closePath();
    ctx.fillStyle = far ? 'rgba(126,170,188,0.55)' : 'rgba(86,138,118,0.78)';
    ctx.fill();
  }
  skySurface(g, bandTop, ground, below, r, clock, surfaceVisible);
}

/* --- Turf and props --------------------------------------------------
   Split out purely to keep each function readable; it is still part of the sky
   biome and is called from skyBiome above with the state it needs. */
/* The turf and the props. Split out of skyBiome only to keep each function
   short enough to read; it is still the same biome, called with the state it
   needs. Everything from here DOWN is the surface, and the soil the layer below
   draws starts on the same line.

   `clock` is passed in rather than recomputed here: it is the same elapsed
   seconds skyBiome uses for the sun, and the two must never disagree about
   what time it is. Passing it keeps the clock a parameter, not a second
   module-level source of truth. */
/* `surfaceVisible` is false when the soil line is off screen. The CLOUDS are
   drawn regardless - they belong to the sky, not to the ground, and on a phone
   the soil line is usually below the fold while the clouds are plainly in view.
   Only the turf and the trees are skipped, because they stand ON that line and
   cannot be drawn when it is not there. */
/* How far ABOVE the soil line the grass reaches at its highest. The seam wanders
   +/-13px, so the grass band is between 17 and 43px tall; this is the tall end
   and the clip below cuts it back to the seam wherever the seam runs high. */
var TURF_TOP = 1130;
function skySurface(g, bandTop, ground, below, r, clock, surfaceVisible) {
  var n, x, gu;

  /* --- The turf: a band of ground, not a 1px line ----------------------
     Gated on surfaceVisible: the turf stands ON the soil line, so with the
     line off screen there is nothing to stand on and drawing it would put
     grass in the middle of the sky. */
  if (surfaceVisible) {
    /* CLIPPED TO ABOVE THE SEAM, and that is the whole point.

       The seam is the top of the soil and it wanders +/-13px, so "the surface"
       has no single Y: a band of a fixed height sits above the grass line in one
       column and below it in the next. The turf used to be a flat 32px rect
       ending at ground+2, which put its lower 23 rows - the cell's own SOIL -
       above the grass line wherever the seam ran high, and left a bare gap below
       it wherever the seam ran low. Clipping both this and the soil in
       render.js to the same curve makes the seam the boundary in both
       directions: grass above, soil below, at every x. */
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-40, ground - TURF_TOP);
    /* SEAM_STEP, not a literal 12. This loop and seamPropY() have to agree on
       where the vertices are, or a prop placed between two vertices lands on
       the true curve while the grass beneath it is the straight chord between
       them - up to 4px apart, which is what made the trees twitch. */
    for (x = -40; x <= viewW + 40; x += SEAM_STEP) ctx.lineTo(x, seamY(below, x));
    ctx.lineTo(viewW + 40, ground - TURF_TOP);
    ctx.closePath();
    ctx.clip();

    /* Three flat bands, brightest on top. This used to be the fallback for a
       missing sheet and is now the only grass there is.

       A flat band is still a band, and three of them at these offsets is a
       stepped edge rather than a soft one. That is deliberate: the alternative
       was a 32px tile, and a tile is worse. A band has no motif, so there is
       nothing for the eye to count, whereas the tile's dark blob repeated ~45
       times across the width and made the surface read as a chain of copies.

       Painted CONTINUOUS terrain, so full width and not per gutter: it is the
       surface the props stand on, and a background with a gap beside the
       panel looks broken rather than framed.

       The rects are the full clipped height, not three thin strips at fixed
       offsets from `ground`. The clip already cuts them to the seam, so sizing
       them to the seam would be the same curve twice; making them span the
       whole clip means each colour simply occupies however much of the varying
       band it happens to cover. */
    var bands = [[9, -4, '#3f6b28'], [5, -7, '#5c9a3e'], [2, -9, '#8fd06a']];
    for (var bi = 0; bi < bands.length; bi++) {
      ctx.fillStyle = bands[bi][2];
      /* From the band's own offset down to well past the lowest the seam can
         get, so the clip can never run off the end of a fill and leave bare sky
         showing through. */
      ctx.fillRect(-40, ground + bands[bi][1], viewW + 80, TURF_TOP + 30);
    }

    /* Grass tufts, standing ON the seam. These are what make the surface read as a
       surface from across the room, rather than as a green rule. Baked by
       bakeTuft() in sprites.js - the grass.png crop that used to feed this was
       dropped, so what draws here is the procedural version. */
    var gt = SET.tufts[(r() * SET.tufts.length) | 0];
    if (gt) {
      for (x = -20; x < viewW + 20; x += 26) {
        /* Standing ON the curve at this tuft's own x, not on a horizontal line
           that is only right in some columns. blitOn anchors the feet, so each
           tuft sits on the grass rather than floating over it or under it. */
        var tx = x + ((r() * 10) | 0);
        /* seamPropY(), not seamY(): the tuft is between two clip vertices, so it
           has to stand on the chord the clip actually drew. */
        blitOn(gt, tx, seamPropY(below, tx) - 1, viewW);
      }
    }
    ctx.restore();          /* release the grass clip */
  }

  /* --- Clouds ------------------------------------------------------------
     The one thing on this layer that moves on its own. The old drift was
     `(scrollY * 0.10) % 460`, which meant the clouds only moved WHILE the
     reader scrolled and sat frozen solid the rest of the time - an animated
     background that is not animating. Time is the right input for ambience.

     Each cloud is given a phase and wrapped modulo the span of the gutter it
     belongs to, rather than having one global offset subtracted from every
     cloud. A global offset eventually drags every cloud off the left edge
     together and the sky empties; per-cloud wrapping keeps it populated.

     Two details make the wrap invisible and the clouds actually visible:
       - a cloud is only drawn while it overlaps its own gutter, and the lane
         margin (80px) is wider than the widest cloud (54px), so a cloud is
         always off screen at the instant its phase wraps - it never pops into
         existence in front of the reader;
       - the clouds live in the GUTTERS. Painted full width they were almost
         entirely behind the opaque panel, so on a desktop layout the sky looked
         as though it had no clouds in it at all. */
  var LANE = 80;
  for (n = 0; n < g.length; n++) {
    gu = g[n];
    if (gu.w < SUN_MIN_GUTTER) continue;       /* too narrow to read as a cloud */
    var span = gu.w + LANE * 2;
    var count = 1 + ((gu.w / 300) | 0);
    for (var c = 0; c < count; c++) {
      var speed = 5 + r() * 7;                /* px per second, leftward */
      var phase = r() * span;
      var cw = Math.min(24 + ((r() * 30) | 0), gu.w - 8);
      var ch = 7 + ((r() * 5) | 0);
      var laneY = ground - 110 - ((r() * 180) | 0);
      if (laneY <= bandTop + 6 || laneY >= ground - 56) continue;
      var cxx = gu.x - LANE + ((phase + clock * speed) % span);
      if (cxx > gu.x + gu.w || cxx + cw < gu.x) continue;   /* off screen */
      var a = (0.55 + r() * 0.20).toFixed(2);  /* nearer clouds are denser */
      px(ctx, cxx, laneY, cw, ch, 'rgba(255,255,255,' + a + ')');
      px(ctx, cxx + 5, laneY - 3, Math.max(4, cw - 12), 4,
         'rgba(255,255,255,' + a + ')');
      px(ctx, cxx + 2, laneY + ch + 4, Math.max(4, cw - 7), 2, 'rgba(255,255,255,0.20)');
    }
  }

}

/* === The props: trees and bushes, in a pass of their own =================
   Split out of the sky biome so render.js can draw them AFTER every band is
   painted, which is the only way the z-order comes out right - see the note on
   drawSurfaceProps() in biomes.js.

   Its own rng, deliberately. The sky biome shares one seeded stream, and the
   cloud loop above CONSUMES A DIFFERENT NUMBER OF DRAWS ON EVERY FRAME: the
   `continue` at the off-screen test is against cxx, which is a function of the
   clock, so a cloud drifting out of the gutter skips the density draw that
   follows it. Every one of those skips shifts the stream the props then read,
   and the meadow visibly reshuffled itself a few times a second while the
   clouds drifted past. A separate stream makes the layout a pure function of
   the gutter geometry, so the trees are where they were put and stay there. */
var PROP_SEED = 0x5EA51DE;
/* How far a trunk is pushed BELOW the soil line. The trees are drawn after the
   soil rather than before it, so this is what plants them in the ground
   instead of balancing them on top of it. */
var TREE_SINK = -3;

/* === Why the meadow looked bare, and what actually fixes it ==================
   Four ceilings, each of which capped the result. None was a matter of taste, so
   the mechanisms matter more than the history:

     1. scaleFor() is an integer MAGNIFIER and bottoms out at 1, so a tree could
        only ever be drawn at 83px or 166px wide - never small enough for a
        48px gutter. The fix is a target DRAWN width (blitOn()'s `wantW`), not a
        smaller gap: shrinking the gap changed nothing, because after the first
        tree the walk cursor was past the end of the strip.
     2. Flowers were drawn inside the tree loop, so their count was capped by
        the tree count: 0.6 flowers per page. The fix is a separate cover pass.
     3. There was no bush at all. The fix is bakeBush().
     4. Props were placed with gutters(), which excludes the panel's whole column.
        Correct for a painter filling the band top to bottom; wrong for props
        standing on the seam, which is half a row-gap BELOW the panel. At 1440
        that put the entire left half of the surface bare. See meadowGutters()
        in biomes.js. */

/* Target widths in CSS pixels. blitOn() anchors the FEET, so a tree is sized by
   its crown and stands up in proportion - an 83x96 conifer at 118px wide stands
   about 137px tall.

   These now EXCEED the source crops, which is only safe because blitOn()
   quantizes magnification up to the next half-step. The sheet crops are 83x96
   and 62x72, so anything above those numbers is being drawn larger than the art
   it came from; without the quantization that would be an uneven resample.

   The values are chosen to LAND ON the half-steps blitOn() can actually draw.
   That is a sharper constraint than it looks: magnification snaps to the nearest
   0.5x, so from an 83px crop only 42, 83, 125, 166, 208 are reachable, and from
   the 62px canopy 31, 62, 93, 124, 155. Any target between two of those silently
   collapses onto the nearer one - a 96px entry came out at 83, because 96/83 is
   1.16x and the nearest half-step is 1.0x. So the spread on screen is only as
   wide as the chosen entries, and a list of arbitrary big numbers looks like
   variety while rendering as two or three sizes.

   EVERY ENTRY IS A 1.5x, 2.5x OR 3.5x MULTIPLE of its crop, never 1x, 2x or 3x,
   and that is deliberate rather than incidental. scaleFor() - the fallback blitOn()
   uses when no target width is passed - returns exactly those integers, so a
   target that resolved to an integer multiple would draw the same width as the
   broken path, and the smoke check that proves the target width reached blitOn()
   could no longer tell the two apart. It stopped catching mutation 14b when 83
   and 166 crept into this list, because those ARE 1x and 2x of the 83px crop:
   dropping the target width entirely became undetectable. So the invariant is
   that no entry here may coincide with an integer scale of either crop.

   The range is wide on purpose. A sapling between two giants is what makes the
   stand read as a wood with depth in it, and a stand where every crown is the
   same size reads as a hedge no matter how many of them there are. */
var TREE_W = [52, 108, 78, 142, 212, 104];
/* Gap between crowns, scaled with the trees. `8 + r()*16` against a 78-212px
   tree is a small fraction of a crown, so neighbouring trees read as one hedge
   and the extra size is wasted on overlap. Still a gap rather than a lane: a
   stand with no space at all between crowns is a solid green mass, which is the
   failure this number exists to prevent. */
var TREE_GAP = 14;
var TREE_JITTER = 22;
var TREE_CLEAR_CHANCE = 0.20;
var TREE_CLEAR = 34;

/* Ground cover on its OWN pass, not as a side effect of the trees. This is the
   decoupling that lets flowers be dense where the trees are sparse, and it is
   why a flower no longer requires a tree to exist.

   Drawn FIRST, so the tree paints over it - that ordering is what makes it read
   as growth at the foot of a trunk rather than tufts floating on the canopy. */
var COVER_STEP = 10;
var COVER_TUFT_CHANCE = 0.8;
var COVER_BUSH_CHANCE = 0.45;
var COVER_FLOWER_CHANCE = 0.7;

function skyProps(g, ground, below) {
  /* TWO independent streams, and the reason is the coupling above. The cover
     pass draws a different number of things than the tree pass, so sharing one
     stream would make every tree's position depend on how many flowers happened
     to be planted first - and the density is exactly what is changing here. */
  var rt = mulberry32(PROP_SEED);
  var rc = mulberry32(PROP_SEED ^ 0x9E37);
  var n, gu, walk, spr, wide, placed = 0;
  for (n = 0; n < g.length; n++) {
    gu = g[n];
    if (gu.w < 16) continue;

    /* --- Ground cover first, so the tree paints over it. ------------------ */
    for (walk = gu.x; walk < gu.x + gu.w; walk += COVER_STEP) {
      var fx = walk + ((rc() * 7) | 0);
      if (fx + 8 > gu.x + gu.w) break;
      var fy = seamPropY(below, fx) + 2;
      if (rc() < COVER_TUFT_CHANCE && SET.tufts.length) {
        blitOn(SET.tufts[(rc() * SET.tufts.length) | 0], fx, fy, gu.w, 8);
      }
      if (rc() < COVER_BUSH_CHANCE && SET.bushes.length) {
        blitOn(SET.bushes[(rc() * SET.bushes.length) | 0], fx, fy, gu.w,
               14 + ((rc() * 12) | 0));
      }
      if (rc() < COVER_FLOWER_CHANCE && SET.blooms.length) {
        var bed = SET.blooms[(rc() * SET.blooms.length) | 0];
        blitOn(bed[(rc() * bed.length) | 0], fx, fy, gu.w, 7);
      }
    }

    /* --- Then the trees, sized to FIT the gutter. ------------------------- */
    walk = gu.x - 4;
    while (walk < gu.x + gu.w) {
      spr = rt() < 0.6
        ? SET.conifers[(rt() * SET.conifers.length) | 0]
        : SET.canopies[(rt() * SET.canopies.length) | 0];
      if (!spr) break;
      /* Cap at the gutter as well as the target, so on a phone - where the one
         gutter can be 16px - a tree shrinks to fit rather than overhanging the
         panel it stands beside. */
      wide = TREE_W[(rt() * TREE_W.length) | 0];
      if (wide > gu.w) wide = gu.w;

      blitOn(spr, walk, seamPropY(below, walk + wide / 2) + TREE_SINK, gu.w, wide);
      placed++;

      walk += wide + TREE_GAP + ((rt() * TREE_JITTER) | 0)
            + (rt() < TREE_CLEAR_CHANCE ? TREE_CLEAR : 0);
    }
  }
  return placed;
}

/* Exported for tools/smoke.mjs so the meadow checks test the REAL values instead
   of restating them as literals in the test file. A copy that drifts is worse
   than no check: it would keep passing while the painter did something else.
   TREE_W is the set of target widths, TREE_GAP the crown spacing the coverage
   floor has to account for, and TREE_SINK the depth the trunk is buried by -
   smoke.mjs needs all three to reconstruct where a tree believes the ground is
   without restating any of them. */
export { skyBiome, skyProps, sunSpot, TREE_W, TREE_GAP, TREE_SINK };
