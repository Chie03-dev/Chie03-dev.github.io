/* ==========================================================================
   sprites.js - the biome sprite bakery
   Every shape the five biomes are built from, generated in code and baked once
   into a small offscreen canvas at load. No image files, no data URIs, and no
   hand-typed character grids.

   Split out of biomes.js purely to keep both files under the 500-line cap, and
   it is a clean seam: this module knows how to DRAW a shape and nothing about
   where shapes go, while biomes.js knows where things go and nothing about how
   they are drawn. Depends on layers.js for the seeded rng, and on nothing else.

   Shapes are generated rather than hand-typed as grids. A grid is the right
   call for something that must look identical every time, like a face. A tree
   only has to look like a tree, and generating it from a seeded rng gives a
   whole family of them for the price of one function while staying identical
   on every reload.
   ========================================================================== */

import { mulberry32 } from './layers.js';
import { ready } from './assets.js';

/* One snapped, axis-aligned pixel rect. Snapping keeps edges crisp on HiDPI,
   where a fractional fill would blur a whole pixel. Exported because biomes.js
   draws the soil and turf with it, and a second copy of this would be a second
   place for the snapping to go missing. Not an inline `export function`:
   this codebase collects its public surface in one block at the bottom, and
   smoke.mjs's graph check reads that block, so an inline export reads as an
   export that does not exist. */
function px(g, x, y, w, h, colour) {
  g.fillStyle = colour;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function surface(w, h) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c: c, g: g };
}

/* A conifer: a serrated triangle over a trunk. `h` is the total height in
   sprite pixels and the width follows from it, so one call makes a whole
   stand of trees at different sizes. */
function bakeConifer(h, pal, rnd) {
  var w = Math.max(7, Math.round(h * 0.60)) | 1;   /* odd, so there is a centre */
  var s = surface(w, h), g = s.g;
  var cx = (w - 1) / 2;
  var trunkH = Math.max(3, Math.round(h * 0.22));
  var canopyH = h - trunkH;

  for (var y = 0; y < canopyH; y++) {
    var t = y / Math.max(1, canopyH - 1);
    var half = Math.round(0.5 + t * (cx - 0.5));
    /* Pull the edge in every third row. That serration is the whole difference
       between a conifer and a triangle. */
    if (y % 3 === 0 && half > 0) half--;
    for (var x = cx - half; x <= cx + half; x++) {
      var col;
      if (x < cx - half + 1) col = pal.shade;        /* away from the light */
      else if (x === cx + half) col = pal.lit;      /* the lit edge      */
      else if (rnd() < 0.14) col = pal.lit;         /* a lit needle      */
      else col = pal.mid;
      px(g, x, y, 1, 1, col);
    }
  }
  var tw = trunkH > 4 ? 3 : 2;
  for (var ty = canopyH; ty < h; ty++) {
    px(g, cx - (tw - 1) / 2, ty, tw, 1, ty < h - 2 ? pal.trunkLit : pal.trunk);
  }
  return s.c;
}

/* A broadleaf: a lumpy dome, lit from the upper left like everything else.
   The conifer alone reads as "tree" but as a very tidy, planted one. This is
   the untidy counterpart, and the two together are what make the surface layer
   look like ground rather than like an orchard. */
function bakeCanopy(w, h, pal, rnd) {
  var s = surface(w, h), g = s.g;
  var trunkH = Math.max(3, Math.round(h * 0.30));
  var tw = Math.max(2, Math.round(w * 0.16));
  px(g, (w - tw) / 2, h - trunkH, tw, trunkH, pal.trunk);
  px(g, (w - tw) / 2, h - trunkH, 1, trunkH, pal.trunkLit);

  /* The crown profile.
     The old code measured a half-ellipse DOWN FROM THE TOP ROW, so the widest
     part of the shape was y=0: it came out as a flat-topped wedge tapering to a
     point at the trunk. That is what read as "the tree is cut in half" - a
     broadleaf with its crown sheared off flat across the top.
     A crown is a full ellipse: rounded at the top, widest a little above the
     middle, drawing back in to meet the trunk. */
  var domeH = h - trunkH + 2;
  var cx = (w - 1) / 2;
  /* halfW is the distance to the last COLUMN, not w/2. A canopy 26 wide with a
     half-width of 13 spans -0.5..25.5, so the loop drew an outside column that
     the `x > w-1` guard then discarded - the crown was silently shaved. */
  var halfW = (w - 1) / 2;
  var shoulder = 0.45;              /* where the crown is widest */
  for (var y = 0; y < domeH; y++) {
    var t = y / Math.max(1, domeH - 1);
    /* k runs 0 at the shoulder to 1 at the top and at the trunk, so half is
       widest at the shoulder. This is one line rather than a wrapped ternary
       only so that tools/mutation-test.ps1 can replace it wholesale with the
       pre-fix expression, `k = t`, which is the actual regression: measuring
       the half-ellipse straight down from the top row put the widest row at
       y=0 and sheared the crown flat. */
    var k = t <= shoulder ? (shoulder - t) / shoulder : (t - shoulder) / (1 - shoulder);
    var half = Math.round(halfW * Math.sqrt(Math.max(0, 1 - k * k)));
    /* Lumps on the edge stop it reading as a perfect circle. */
    if (y % 2 === 0) half += rnd() < 0.5 ? 1 : 0;
    if (y > domeH * 0.35 && y < domeH * 0.8 && rnd() < 0.25) half += 1;
    /* Where the crown meets the trunk it must stay at least trunk-wide, or the
       two separate and the tree reads as a lollipop on a stick. */
    if (y > domeH - 2) half = Math.max(half, Math.round(tw / 2) + 1);
    if (half > halfW) half = halfW;   /* never past the last column */
    for (var x = cx - half; x <= cx + half; x++) {
      if (x < 0 || x > w - 1) continue;
      /* Shade by distance from a light source up and to the LEFT, so the crown
         turns round rather than reading as one flat panel of green with a
         lighter strip down one side. */
      var dx = (x - cx) / Math.max(1, halfW);
      var lx = dx + 0.22;                 /* the lit side is the left one */
      var ly = t - 0.30;
      var d = Math.sqrt(lx * lx * 0.75 + ly * ly);
      var col = d < 0.30 ? pal.lit
              : d < 0.52 ? (rnd() < 0.16 ? pal.core || pal.lit : pal.mid)
              : d < 0.74 ? pal.mid
              : pal.shade;
      px(g, x, y, 1, 1, col);
    }
  }
  return s.c;
}

/* A flower on a stem. The petals take their colour from the palette, so the
   same function makes the magenta, gold, cyan and coral beds - which is how
   the surface layer gets colour without a new idea per flower. */
function bakeBloom(stemH, pal) {
  var w = 7, h = stemH + 5;
  var s = surface(w, h), g = s.g;
  var cx = 3;
  for (var y = stemH; y < h; y++) px(g, cx, y, 1, 1, pal.stem);
  px(g, cx - 1, stemH + 2, 1, 2, pal.leaf);          /* one leaf */
  var top = stemH - 3;
  px(g, cx - 1, top, 3, 1, pal.petal);              /* petal cross */
  px(g, cx, top - 1, 1, 3, pal.petal);
  px(g, cx - 2, top + 1, 1, 1, pal.petalDim);
  px(g, cx + 2, top + 1, 1, 1, pal.petalDim);
  px(g, cx, top, 1, 1, pal.core);                   /* the bright centre */
  return s.c;
}

/* A tuft of grass. Blades of different heights, so a row of them does not
   read as a comb. */
function bakeTuft(w, h, pal, rnd) {
  var s = surface(w, h), g = s.g;
  for (var i = 0; i < w; i += 2) {
    var bh = Math.round(h * (0.45 + rnd() * 0.55));
    px(g, i, h - bh, 1, bh, i % 4 === 0 ? pal.lit : pal.mid);
  }
  return s.c;
}

/* The angular mineral, rounded lump, masonry slab, book shelf and hanging root
   bakers lived here and have been removed along with the rock decorations they
   served. Only the surface foliage bakers remain: bakeConifer, bakeCanopy,
   bakeTuft and bakeBloom. */

/* === The sprite set =====================================================
   Baked once, at module load, exactly like the player sprite in layers.js.
   Every list is two or three entries so a biome can vary a shape without
   repeating itself down a long band. */

var PAL = {
  /* Surface. Two greens for the canopy plus a warm trunk; the flowers get
     their petals from the palette so one baker makes the whole bed. */
  leaf: {
    shade: '#1f3d1c', mid: '#3f7a3a', lit: '#6cb85a', core: '#8fd06a',
    trunk: '#3a2a1c', trunkLit: '#5c4128', stem: '#2f6b2c'
  },
  /* Only the surface palette is left. The soil, ore, rock, moss, ice and deep
     palettes existed solely for the rock decorations and went with them; the
     rock bands now take their colour from the ROCK table in layers.js, which
     paints the gradients directly. */
};

/* Flowers. Four beds, deliberately the loudest colours on the page: this is
   the one layer allowed to be cheerful, and it is the first thing a visitor
   sees. They are the only saturated hues anywhere in the canvas. */
var FLOWERS = [
  { petal: '#ff5ec4', petalDim: '#c02e8c', core: '#fff3d0' },  /* magenta */
  { petal: '#ffd24a', petalDim: '#c08a12', core: '#fff8d8' },  /* gold    */
  { petal: '#5ee0ff', petalDim: '#1f92c4', core: '#eafcff' },  /* cyan    */
  { petal: '#ff8a3d', petalDim: '#c2521a', core: '#ffe8c8' }   /* coral   */
];

var SET = {};
function bakeSet() {
  var r = mulberry32(20260930);
  SET.conifers = [bakeConifer(22, PAL.leaf, r), bakeConifer(30, PAL.leaf, r),
                  bakeConifer(17, PAL.leaf, r)];
  /* bakeCanopy takes BOTH a width and a height - a broadleaf is wider than it
     is tall, which is the whole difference from a conifer - so the call has to
     pass both. It used to be called as bakeCanopy(26, PAL.leaf, r), which fed
     the palette in as `h`: trunkH became NaN, the dome loop never ran (so
     nothing threw at bake time), and the sprite was created with height NaN.
     That NaN reached drawImage as the destination height, where a real browser
     throws IndexSizeError, render() died on the first frame, and the page was
     left with nothing but the base fill - a black background and no sprite. */
  SET.canopies = [bakeCanopy(21, 19, PAL.leaf, r), bakeCanopy(26, 23, PAL.leaf, r)];
  SET.tufts = [bakeTuft(9, 6, PAL.leaf, r), bakeTuft(7, 4, PAL.leaf, r)];
  SET.blooms = FLOWERS.map(function (petals) {
    var pal = { stem: PAL.leaf.stem, leaf: PAL.leaf.mid,
                petal: petals.petal, petalDim: petals.petalDim, core: petals.core };
    return [bakeBloom(6, pal), bakeBloom(9, pal), bakeBloom(4, pal)];
  });
  /* The rock decorations - soil, roots, ore, masonry, moss, crystals, spikes,
     strata, nuggets and book shelves - were baked here and have been removed.
     Only the surface foliage and the player/hoist sprites remain; the rock
     bands are painted from their band geometry in render.js, which needs no
     sprites at all. Removing the bakes also removed the only callers of
     bakeChunk, bakeRoot, bakeSlab, bakeShard and bakeShelf. */
}
bakeSet();

/* The sheets from assets/PixelArt, once they have decoded.

   These REPLACE the drawn foliage rather than sitting beside it. The drawn
   versions stay as the fallback: load() resolves with ok=false on a failed
   request, and the surface layer with no trees on it is a visibly broken
   page, so the procedural set is still baked and is still what paints when
   the sheets are absent. The swap happens in applySheets(), which is called
   from the loader's callback - never at module load, because at module load
   every slice would still be null.

   assets.js imports nothing, so importing it here adds a leaf to the graph
   rather than an edge between two modules that already know each other. */
function applySheets(a) {
  if (!a || !a.ok) return false;
  /* Trees become a two-variant set keyed the way the painter already reads
     them, so conifers get the tall sheet crop and canopies the smaller one -
     which is also what those two crops actually depict. */
  if (a.trees.length) {
    SET.conifers = [a.trees[0]];
    SET.canopies = a.trees.length > 1 ? [a.trees[1]] : [a.trees[0]];
  }
  if (a.tufts.length) SET.tufts = a.tufts;
  if (a.bushes.length) SET.bushes = a.bushes;
  SET.turf = a.turf;
  SET.dirt = a.dirt;
  return true;
}
/* Fires `cb` once, when the sheets land either way. main.js waits on this
   before its first frame so the page never paints a frame with the drawn
   art and then visibly swaps it for the real sheets. */
function whenSheets(cb) {
  ready(function (a) { applySheets(a); cb(a); });
}

/* Public surface of this module, collected here so that not one line of the
    code above needed a keyword added to it. */
export { SET, PAL, FLOWERS, px, bakeSet, applySheets, whenSheets };
