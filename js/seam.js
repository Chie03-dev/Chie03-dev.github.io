/* ==========================================================================
   seam.js - the jagged line between two rock layers
   ==========================================================================
   PURPOSE. Two things that had outgrown layers.js: the deterministic RNG every
   decoration is built from, and the geometry of the seam itself - the wavy
   boundary between one layer and the next, and the function that puts a prop on
   it.

   WHY A SEPARATE FILE

   mulberry32 is a pure function of its seed and depends on nothing. It was
   imported by eleven modules through layers.js, which is otherwise a module
   holding a <canvas> and the page measurement - so a number generator was only
   reachable by loading the DOM. It is a leaf now and layers.js imports it like
   anyone else.

   The seam moved with it because it needs mulberry32 and nothing else, so the two
   travelled together rather than leaving a seam module that imports a noise module
   to reach its own generator.

   THE ONE THING THAT COMES IN: the scroll. The seam is drawn in DOCUMENT space, so
   it needs to know where the reader is, and that is live page state belonging to
   layers.js. It arrives through setScroll() rather than an import, because the
   import would be a cycle - layers.js needs the seam, and the seam would then need
   layers.js. One writer, one reader, no cycle.
   ========================================================================== */

var scrollY = 0;

/* Called by layers.js on every scroll. The only way anything gets in here. */
function setScroll(y) { scrollY = y; }

function mulberry32(seed) {
  return function () {
    seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* 1D value noise with smoothstep interpolation -> soft rolling shapes. */
function makeNoise(seed, cells) {
  var rnd = mulberry32(seed);
  var table = new Float32Array(cells + 1);
  var i;
  for (i = 0; i <= cells; i++) table[i] = rnd();
  return function (x) {
    var t = x * cells;
    var i0 = Math.floor(t);
    var f = t - i0;
    var s = f * f * (3 - 2 * f);
    var a = table[((i0 % cells) + cells) % cells];
    var b = table[(((i0 + 1) % cells) + cells) % cells];
    return a + (b - a) * s;
  };
}

var seamNoise = makeNoise(9001, 40);    /* jagged layer boundaries */

/* Screen Y of a layer's top boundary, with a stable jagged profile.

   This lives here rather than in render.js because the surface biome needs the
   SAME curve the renderer strokes. When biomes.js guessed its own ground line
   while render.js drew the real seam, the two drifted apart and the grass the
   trees stood on was not the grass that was drawn - which is exactly the
   "surface floats above the soil" bug. One function, one curve.

   ROUNDED TO WHOLE PIXELS, and that is not tidiness. This returns a fractional
   y, and its two consumers disagree about that. The renderer strokes it into a
   path, so the browser antialiases the seam and it slides smoothly; blitOn()
   rounds the sprite's destination, so a tree only ever lands on a whole pixel.
   The seam therefore moves continuously while the tree steps, and by a fraction
   of a pixel in opposite directions - so the trees visibly CRAWL against the
   soil they are planted in as the page scrolls. It is a sub-pixel shimmer rather
   than a slide, which is why it reads as "something is moving" without pointing
   at anything in particular.

   Rounding here fixes it at the source rather than in blitOn(), because the
   rounding has to be SHARED. Rounding only the sprite leaves the seam's edge
   antialiased against a hard pixel edge, so the gap between them still varies
   with sub-pixel position. Both consumers now read one integer, the seam is
   stroked on the pixel grid, and the tree sits exactly on it at every scroll
   offset. On art with imageSmoothingEnabled off this is also the crisper
   result: a seam that lands on whole pixels has no soft edge to bleed into the
   soil below it. */
function seamY(layer, x) {
  return Math.round(layer.top - scrollY +
                    (seamNoise(x / 260 + layer.top * 0.0007) - 0.5) * 10);
}

/* Horizontal step of the traced seam polyline. Every consumer has to agree on
   this, because the seam is only ever APPROXIMATED by a polyline: the browser
   joins the vertices with straight lines, so between two vertices the drawn edge
   is the CHORD, not the curve. A prop standing at its own x is placed on the
   true curve while the ground beneath it is that chord, and the two disagree by
   up to ~4px on a steep section. See seamPath() for what that looked like. */
var SEAM_STEP = 12;
/* The x of the seam vertex at or immediately before `x`, so a caller that needs
   to place a prop ON the drawn polyline can find the segment it belongs to
   instead of trusting the raw curve. Exported with seamY because render.js and
   biome-sky.js both need the pair. */
function seamVertexX(x) {
  return Math.floor((x + 40) / SEAM_STEP) * SEAM_STEP - 40;
}

/* The seam y a prop standing at `x` should actually use: the value on the DRAWN
   polyline, not the raw curve.

   This is the fix for trees that twitched while scrolling, and the reason only
   SOME of them did it. The seam is traced at SEAM_STEP intervals and the browser
   joins those vertices with straight lines, so the visible ground between two
   vertices is the chord. A tree sampling seamY() at its own x got the true curve
   value, which on a steep section is up to ~4px away from the chord it is
   standing on. Scrolling then moved the two past each other in opposite
   directions - the tree on the curve, the grass on the chord - and the tree
   visibly twitched within its own shadow.

   Flat sections did NOT reliably hide it, which is why it looked arbitrary.
   Measured across the trees on screen, the worst disagreement ranged from 0.41px
   (x=1292) to 3.97px (x=842) - and it is not monotonic in the local slope,
   because it also depends on how far the prop sits from the nearest vertex. What
   decides which trees twitch is simply whether that product happens to cross a
   pixel boundary as the page scrolls, so the set of twitchers changes with the
   camera and looks uncorrelated with anything visible.

   Interpolating between the two bracketing vertices makes the prop and the
   ground read from the same polyline, so they cannot disagree by construction
   rather than by luck. */
function seamPropY(layer, x) {
  var x0 = seamVertexX(x);
  var y0 = seamY(layer, x0);
  if (x === x0) return y0;
  /* Only ever one step along: x0 is the vertex at or before x by construction. */
  return y0 + (seamY(layer, x0 + SEAM_STEP) - y0) * ((x - x0) / SEAM_STEP);
}

/* Public surface. */
export {
  mulberry32,
  makeNoise,
  seamNoise,
  seamY,
  seamVertexX,
  seamPropY,
  setScroll,
  SEAM_STEP
};
