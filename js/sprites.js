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

  var domeH = h - trunkH + 2;
  for (var y = 0; y < domeH; y++) {
    var t = y / Math.max(1, domeH - 1);
    /* A half-ellipse, so the silhouette is round rather than rectangular. */
    var half = Math.round((w / 2) * Math.sqrt(Math.max(0, 1 - t * t * 0.92)));
    /* Lumps on the edge stop it reading as a perfect circle. */
    if (y % 2 === 0) half += rnd() < 0.5 ? 1 : 0;
    for (var x = (w - 1) / 2 - half; x <= (w - 1) / 2 + half; x++) {
      if (x < 0 || x > w - 1) continue;
      var d = (x - ((w - 1) / 2 - half)) / Math.max(1, 2 * half);
      var col = d < 0.28 ? pal.lit : (d > 0.74 ? pal.shade :
                (rnd() < 0.12 ? pal.lit : pal.mid));
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

/* An angular mineral shape: crystals, stalactites, stalagmites, ice. `down`
   flips which end it points at, so one function covers a cave ceiling and a
   cave floor. */
function bakeShard(h, pal, rnd, down) {
  var w = Math.max(5, Math.round(h * 0.42)) | 1;
  var s = surface(w, h), g = s.g;
  for (var y = 0; y < h; y++) {
    var t = y / Math.max(1, h - 1);
    var half = Math.round(0.5 + t * ((w - 1) / 2));
    for (var x = (w - 1) / 2 - half; x <= (w - 1) / 2 + half; x++) {
      if (x < 0 || x > w - 1) continue;
      var col = x < (w - 1) / 2 ? pal.lit : (x > (w - 1) / 2 - 1 ? pal.shade :
                (rnd() < 0.10 ? pal.core : pal.mid));
      px(g, x, down ? y : h - 1 - y, 1, 1, col);
    }
  }
  return s.c;
}

/* A rounded lump: pebbles, ore, nuggets, clods. `banded` adds a horizontal
   seam so it reads as mineral rather than as a pebble. */
function bakeChunk(w, h, pal, rnd, banded) {
  var s = surface(w, h), g = s.g;
  for (var y = 0; y < h; y++) {
    var t = y / Math.max(1, h - 1);
    var half = Math.round((w / 2) * Math.sqrt(Math.max(0, 1 - Math.pow(t * 2 - 1, 2))));
    for (var x = (w - 1) / 2 - half; x <= (w - 1) / 2 + half; x++) {
      if (x < 0 || x > w - 1) continue;
      var col = x < (w - 1) / 2 - half + 1 ? pal.lit : pal.mid;
      if (banded && y === Math.floor(h * 0.55)) col = pal.core;
      if (rnd() < 0.10) col = pal.shade;
      px(g, x, y, 1, 1, col);
    }
  }
  return s.c;
}

/* A squared-off block with a mortar joint: the masonry of the vault, and the
   strata of the bedrock. */
function bakeSlab(w, h, pal, rnd) {
  var s = surface(w, h), g = s.g;
  px(g, 0, 0, w, h, pal.mid);
  px(g, 0, 0, w, 1, pal.lit);
  px(g, 0, h - 1, w, 1, pal.shade);
  px(g, 0, Math.floor(h / 2), w, 1, pal.shade);       /* the mortar course */
  px(g, 1 + Math.floor(w / 2), 0, 1, Math.floor(h / 2), pal.shade);
  px(g, Math.floor(w / 4), Math.floor(h / 2), 1, h - Math.floor(h / 2), pal.shade);
  for (var i = 0; i < 3; i++) {
    px(g, Math.floor(rnd() * w), 1 + Math.floor(rnd() * (h - 2)), 1, 1, pal.core);
  }
  return s.c;
}

/* A row of book spines. The bedrock layer is the ancient library, and this is
   the one motif that says so without a word of copy. */
function bakeShelf(w, h, pal, rnd) {
  var s = surface(w, h), g = s.g;
  px(g, 0, 0, w, h, pal.mid);
  px(g, 0, 0, w, 1, pal.lit);
  px(g, 0, h - 2, w, 2, pal.shade);              /* the plank it stands on */
  var x = 1;
  var spines = ['#8c5a3c', '#6b7f4a', '#8a4a52', '#4a6b8c', '#7a6a3c', '#5a4a7a'];
  while (x < w - 2) {
    var bw = 1 + Math.floor(rnd() * 3);
    if (x + bw > w - 2) break;
    var bh = h - 4 - Math.floor(rnd() * 2);
    px(g, x, h - 2 - bh, bw, bh, spines[Math.floor(rnd() * spines.length)]);
    px(g, x, h - 2 - bh, bw, 1, pal.core);       /* the gilt band on top */
    x += bw + 1;
  }
  return s.c;
}

/* A hanging root, for the dirt layer: thinner than a shard, and it grows
   downward out of a soil line rather than out of a wall. It is what makes the
   dirt band read as the layer directly under the grass, and it is the reason
   the surface and the mine feel like one continuous cut rather than two
   unrelated bands. */
function bakeRoot(h, pal, rnd) {
  var w = Math.max(5, Math.round(h * 0.5)) | 1;
  var s = surface(w, h), g = s.g;
  var cx = (w - 1) / 2;
  for (var y = 0; y < h; y++) {
    /* Wander sideways as it descends, so a row of them is not a fringe. */
    cx += (rnd() - 0.5) * 0.9;
    cx = Math.max(1, Math.min(w - 2, cx));
    px(g, cx, y, 1, 1, y % 3 === 0 ? pal.lit : pal.mid);
    if (rnd() < 0.16) px(g, cx + (rnd() < 0.5 ? -1 : 1), y, 1, 2, pal.shade);
  }
  return s.c;
}

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
  soil: { lit: '#8a5a3c', mid: '#5c3a26', shade: '#3a2318', core: '#a8703f' },
  ore:  { lit: '#ffd98a', mid: '#e0a93c', shade: '#8a5f18', core: '#fff3d0' },
  /* Vault masonry: cold grey stone with a lit top arris. */
  rock: { lit: '#7d8794', mid: '#5b6470', shade: '#333b45', core: '#9aa5b2' },
  moss: { lit: '#5c8a3a', mid: '#3d6b28', shade: '#26401a', core: '#7fb04a' },
  /* Cave crystal: the one place the palette goes cold and bright. */
  ice:  { lit: '#bfe6f2', mid: '#6fa8bf', shade: '#2f5f75', core: '#eaf9ff' },
  /* Bedrock: near-black with an amber vein, so the treasure room reads as
     the deepest and warmest rock rather than as more cave. */
  deep: { lit: '#4a5460', mid: '#2b323b', shade: '#12161b', core: '#ffd24a' }
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
  SET.soil = [bakeChunk(9, 6, PAL.soil, r, false), bakeChunk(6, 4, PAL.soil, r, false)];
  SET.roots = [bakeRoot(16, PAL.soil, r), bakeRoot(24, PAL.soil, r)];
  SET.ore = [bakeChunk(11, 7, PAL.ore, r, true), bakeChunk(8, 5, PAL.ore, r, true)];
  SET.blocks = [bakeSlab(18, 10, PAL.rock, r), bakeSlab(14, 9, PAL.rock, r)];
  SET.moss = [bakeChunk(10, 5, PAL.moss, r, false)];
  SET.crystals = [bakeShard(15, PAL.ice, r, false), bakeShard(21, PAL.ice, r, false)];
  SET.spikesDown = [bakeShard(14, PAL.rock, r, true), bakeShard(19, PAL.rock, r, true)];
  SET.spikesUp = [bakeShard(11, PAL.rock, r, false), bakeShard(15, PAL.rock, r, false)];
  SET.strata = [bakeSlab(20, 8, PAL.deep, r), bakeSlab(15, 7, PAL.deep, r)];
  SET.nuggets = [bakeChunk(9, 7, PAL.deep, r, true)];
  SET.shelves = [bakeShelf(20, 12, PAL.deep, r), bakeShelf(15, 11, PAL.deep, r)];
}
bakeSet();

/* Public surface of this module, collected here so that not one line of the
   code above needed a keyword added to it. */
export { SET, PAL, FLOWERS, px, bakeSet };
