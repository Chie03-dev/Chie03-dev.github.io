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
  ctx, viewW, viewH, scrollY, mulberry32, layers
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
  skySurface(g, bandTop, ground, r, clock, surfaceVisible);
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
function skySurface(g, bandTop, ground, r, clock, surfaceVisible) {
  var n, x, gu;

  /* --- The turf: a band of ground, not a 1px line ----------------------
     Three stacked strokes sitting ON the soil line, so the grass has real
     thickness and meets the dirt the layer below draws without a gap.

     Gated on surfaceVisible: the turf stands ON the soil line, so with the line
     off screen there is nothing to stand on and drawing it would put grass in
     the middle of the sky. */
  var bands = [[9, -4, '#3f6b28'], [5, -7, '#5c9a3e'], [2, -9, '#8fd06a']];
  if (surfaceVisible) {
    for (var bi = 0; bi < bands.length; bi++) {
      ctx.fillStyle = bands[bi][2];
      ctx.fillRect(-40, ground + bands[bi][1], viewW + 80, bands[bi][0]);
    }

    /* Grass blades standing up off the turf. These are what make the surface
       read as a surface from across the room, rather than as a green rule. */
    for (x = -20; x < viewW + 20; x += 3) {
      var bh = 5 + ((r() * 10) | 0);
      px(ctx, x, ground - 9 - bh, 2, bh, r() < 0.35 ? '#8fd06a' : '#5c9a3e');
    }
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

  /* --- Props, in the gutters, standing ON the horizon -------------------
     blitOn() anchors a sprite's feet to the ground line, so every tree meets
     the grass instead of hovering above it or sinking into the soil.

     Skipped entirely when the soil line is off screen. The old inner test was
     `ground > bandTop - 60 && ground < viewH + 60`, which re-checked the same
     thing on every tree in every cell; hoisting it out means the rng is consumed
     identically whether or not the ground is visible, so the meadow is laid out
     the same way at every scroll position and does not reshuffle as it moves. */
  if (!surfaceVisible) return;
  for (n = 0; n < g.length; n++) {
    gu = g[n];
    if (gu.w < 12) continue;

    /* Walk the gutter, dropping trees with a guaranteed gap between crowns so
       the meadow stays open instead of becoming a wall of foliage. */
    var walk = gu.x - 6;
    while (walk < gu.x + gu.w) {
      var spr = r() < 0.6
        ? SET.conifers[(r() * SET.conifers.length) | 0]
        : SET.canopies[(r() * SET.canopies.length) | 0];
      blitOn(spr, walk, ground, gu.w);
      /* Ground cover and a flower at the trunk, so nothing looks pasted on. */
      if (r() < 0.7) {
        blitOn(SET.tufts[(r() * SET.tufts.length) | 0],
               walk + ((r() * spr.width * scaleFor(spr, gu.w)) | 0), ground, gu.w);
      }
      if (r() < 0.6) {
        var bed = SET.blooms[(r() * SET.blooms.length) | 0];
        blitOn(bed[(r() * bed.length) | 0], walk + ((r() * 12) | 0), ground, gu.w);
      }
      walk += 20 + ((r() * 38) | 0) + (r() < 0.22 ? 44 : 0);
    }
  }
}

export { skyBiome, sunSpot };
