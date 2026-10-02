/* ==========================================================================
   layers.js - the world: canvas, layers, measurement and art assets
   ==========================================================================
   Everything that describes WHAT the cave is rather than what happens in
   it. Owns the canvas and its 2d context, the viewport size and DPR, the
   five layer definitions and the measurement that maps them onto the real
   DOM sections, the shaft geometry, the deterministic noise, the baked rock
   textures and the 16x16 player sprite.

   The car floor, its travel band and the scroll mapping that drive it are NOT
   here - see deck.js. What this module holds is measured once and then only
   read; deck.js holds the state that changes every frame. Splitting on that
   line is what keeps both files under the 500-line cap.

   Depends on bands.js only, so the graph stays a chain with no cycles:
   layers <- deck <- game <- render, with ui and main sitting on top.
   ========================================================================== */

import { bandEdges } from './bands.js';
import { SPRITE_W, SPRITE_H, FRAME_MS, SPRITES } from './avatar.js';
/* cave.js is a leaf - it imports nothing - so this only adds a leaf to the graph
   rather than an edge between two modules that already know each other. It has
   to live HERE rather than in main.js: measure() below is where the cave is
   re-measured, because that is the one function every other re-measure already
   passes through. */
import { measureCave } from './cave.js';

var canvas = document.getElementById('stage');
var ctx = canvas.getContext('2d', { alpha: false });
var clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
/* The page background comes from the CSS custom property --deep (the old
   "lantern" token). Read it once from the cascade so the canvas base fill
   can never drift out of sync with the CSS, and there is one place to change
   the colour rather than a hex repeated in both layers. */
var DEEP = (function () {
  var v = window.getComputedStyle(document.documentElement)
            .getPropertyValue('--deep').trim();
  return v || '#14181e';
})();

/* === 2. Layers ===========================================================
   Each resume <section> IS a layer. Measuring the real elements instead of
   hard-coding pixel offsets means the art can never drift out of sync with
   the text when the copy reflows on a phone or a panel grows taller. */
var LAYER_DEFS = [
  { id: 'summary',    name: 'Sky',     rock: 'sky'     },
  { id: 'skills',     name: 'Dirt',    rock: 'dirt'    },
  { id: 'projects',   name: 'Stone',   rock: 'stone'   },
  { id: 'experience', name: 'Caves',   rock: 'caves'   },
  { id: 'education',  name: 'Bedrock', rock: 'bedrock' }
];

/* Two-stop gradient per layer, top of the band -> bottom of the band. */
var ROCK = {
  sky:     { top: '#3f9fd6', bot: '#bfe7f7' },
  dirt:    { top: '#8a5a3c', bot: '#4b2d1f' },
  stone:   { top: '#5b6470', bot: '#2d343c' },
  caves:   { top: '#3d4650', bot: '#141920' },
  bedrock: { top: '#232a33', bot: '#0a0d11' }
};
/* Extra wash inside the shaft so each depth feels like a different material. */
var SHAFT_TINT = {
  sky: 'rgba(255,255,255,0.10)', dirt: 'rgba(0,0,0,0.14)',
  stone: 'rgba(0,0,0,0.22)', caves: 'rgba(0,0,0,0.34)',
  bedrock: 'rgba(0,0,0,0.46)'
};
var layers = [];
var viewW = 0, viewH = 0, dpr = 1;
var maxScroll = 1;
/* Document-space anchors for the car's travel window, measured from the MARKUP
   rather than from layer indices, because the rule is written in terms of the
   rooms themselves: the car sets off at the DIRT and stops just before the
   Bedrock treasure room. Naming the rooms means reordering the sections, or
   inserting one, cannot silently move the stops - a layer index would. */
var travelFrom = 0, travelTo = 0;

/* Document-space Y of the first element matching `sel`, or -1 if there is none.
   The -1 matters: it is how the caller tells "not found" from "found at 0",
   which a falsy check would conflate. */
function docTopOf(sel) {
  var el = document.querySelector(sel);
  if (!el) return -1;
  return Math.round(el.getBoundingClientRect().top + (window.scrollY || 0));
}
var TOTAL_METRES = 32;          /* depth reading shown at the very bottom */
var metresPerPx = 0.01;
var scrollY = window.scrollY || 0;

/* Scroll lives here because it is world state, and an ES module cannot assign
   to another module's import. main.js used to do `scrollY = window.scrollY`
   directly; inside a module that line is an illegal write to a read-only
   binding, and in strict mode it throws - which killed the requestAnimationFrame
   loop on its very first frame and left the canvas never painted at all. It
   calls this instead. */
function syncScroll() {
  scrollY = window.scrollY || 0;
  /* Deliberately does NOT re-seat the car. It used to, and that is now
     advanceCar()'s job in deck.js, because a module cannot import back into its
     own dependency: deck.js reads scrollY from here, so calling into it from
     here would close a cycle. The same clamp still happens every frame, just
     from the side that owns the car. */
}

function measure() {
  var i, def, el, rect, panels = [], edges;
  /* Rebuilt from scratch every time. Without this reset the array GREW by one
     set of layers per call, and measure() runs on every resize, on load and on
     fonts.ready - so activeLayerIndex(), drawBands() and the depth rail all
     walked a list several times too long, painting the same bands repeatedly
     and reading layer[0] from a geometry that no longer matched the page. */
  layers = [];
  for (i = 0; i < LAYER_DEFS.length; i++) {
    def = LAYER_DEFS[i];
    el = document.getElementById(def.id);
    if (!el) continue;
    /* getBoundingClientRect + scrollY = absolute document position, which is
       correct no matter which ancestor happens to be the offsetParent. */
    rect = el.getBoundingClientRect();
    panels.push({
      id: def.id, name: def.name, rock: def.rock, el: el,
      /* The PANEL box, kept under its own names. The band is derived from these
         in bands.js rather than being the same rectangle, so that every chamber
         sits INSIDE its layer with rock above and below it rather than covering
         it end to end. */
      panelTop: Math.round(rect.top + (window.scrollY || 0)),
      panelBottom: Math.round(rect.bottom + (window.scrollY || 0)),
      /* left and width are the PANEL's horizontal box, and unlike top/bottom
         they need no scroll correction - a horizontal scroll does not exist.
         They are here for one reason: each section IS its chamber panel, so
         without them the biome art has no idea how much of each band the panel
         covers, and places its detail at random across the full width where the
         panel then paints over it. With them the art can be put in the gutters
         the panel does NOT cover, which is the only part of a biome a reader
         ever sees. See biomes.js. */
      left: Math.round(rect.left),
      width: Math.round(rect.width)
    });
  }
  /* The last band has to reach the bottom of the treasure room, not the bottom
     of the last chamber, or the bedrock stops short and leaves bare canvas
     between the Education panel and the contact room. The plain-resume
     <details> below it carries its own opaque background, so the bands stop
     there. Falls back to the document height when the room is not found. */
  var floorY = (function () {
    var t = document.querySelector('.treasure');
    if (t) {
      var r = t.getBoundingClientRect();
      if (r && r.height >= 0) return Math.round(r.bottom + (window.scrollY || 0));
    }
    return document.documentElement.scrollHeight;
  })();
  edges = bandEdges(panels, floorY);
  for (i = 0; i < panels.length; i++) {
    layers.push({
      id: panels[i].id, name: panels[i].name, rock: panels[i].rock,
      el: panels[i].el, left: panels[i].left, width: panels[i].width,
      top: edges[i].top, height: edges[i].height, bottom: edges[i].bottom,
      /* The panel box is kept on the layer as well as being what the band was
         derived from. Two reasons: the smoke test asserts the band really does
         enclose its panel (that is the whole regression), and it means anything
         that needs to reason about the panel - as opposed to the rock - has the
         numbers to hand instead of re-measuring the DOM. */
      panelTop: panels[i].panelTop, panelBottom: panels[i].panelBottom
    });
  }
  /* The travel window. `data-layer` is already on every section for the band
     art, so the same attribute names the rooms the car travels between. The
     treasure room is also data-layer="bedrock" - it is a contact room, not a
     chamber - which is exactly why it is selected by its class and not by its
     layer: the car stops BEFORE it, at the top of that section.

     The treasure room is also the invisible barrier the sprite is stopped by,
     and it has to be reached EARLY rather than exactly. The room spans all three
     grid columns, so it sits underneath the shaft the sprite rides in: once it
     fills the viewport there is nowhere on screen the sprite can stand without
     being drawn over the room. So travelTo is pulled back by one viewport of
     scroll, which parks the car at the bottom of its band while the room is
     still entirely below the fold.

     Why it is done in DOCUMENT space rather than by clamping the car per frame:
     a screen-space cap at the room's top edge would DECREASE as the reader
     scrolls down, which pulls the car back UP the band while the page descends
     - a direction reversal, the exact defect the monotonic-travel rule and
     smoke.mjs exist to prevent. A document-space stop is monotonic by
     construction, so nothing about the motion model changes. The sprite is
     still drawn over the room once you scroll into it; what this fixes is the
     car descending INTO the room on the way down. */
  var dirt = docTopOf('[data-layer="dirt"]');
  var treasure = docTopOf('.treasure');
  travelFrom = dirt >= 0 ? dirt : (layers.length > 1 ? layers[1].top : 0);
  travelTo = treasure >= 0 ? treasure : (layers.length ? layers[layers.length - 1].bottom : 0);
  /* One viewport of clearance. viewH rather than window.innerHeight so the
     canvas and the barrier are measured from the same number, and Math.max(1)
     so an unmeasured viewport cannot invert the window. The floor of 1px of
     clearance keeps the stop strictly above the room rather than level with it,
     so the sprite's feet never touch the room's top edge. */
  travelTo = Math.max(travelTo - Math.max(1, viewH), travelFrom + 1);
  maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  metresPerPx = TOTAL_METRES / maxScroll;
  /* The cave is re-measured here, from the same event that positions everything
     else, and for the same reason: it reads the room's real box, so a reflow that
     moves the room moves the floor with it. Measuring it on a timer or on the
     first frame instead would leave the floor describing a layout the reader is
     no longer looking at - and because the floor's screen position is derived
     from the room's document top, a stale room top is a floor that scrolls at
     the wrong rate against the HTML sitting on it. */
  /* viewW and viewH - the numbers this canvas was actually sized from, and the
     numbers the bands are drawn in. NOT window.innerWidth/innerHeight: those are
     undefined under the smoke stub, and they are not what the renderer uses
     either. Handing the cave the canvas's own size is what makes its walls agree
     with the floor and the art, which already span the real viewport. */
  measureCave(viewW, viewH);
}

/* Which layer owns a given document-space Y. Linear over five items, so a
   reverse scan beats rebuilding an index on every scroll frame. */
function layerIndexAt(worldY) {
  for (var i = layers.length - 1; i >= 0; i--) {
    if (worldY >= layers[i].top) return i;
  }
  return 0;
}
/* Which layer counts as "the one you are reading": the one at the middle of
   the viewport, because that is the row actually filling the screen.

   This used to be worked out two different ways. drawShaft() asked for the
   viewport midpoint to pick the shaft's tinted material, while ui.js asked
   for the viewport top edge to light the doorway and the depth rail, so the
   material in the shaft and the lit door could disagree by a whole layer. The
   car's travel band is scoped to the active layer as well, so all three now
   ask one function and there is a single answer. */
function activeLayerIndex() {
  return layerIndexAt(scrollY + viewH * 0.5);
}
/* The shaft is a real grid column, so the canvas should not guess where it
   is. Measure the element and use its box for the walls, the car, the guides,
   the collision walls and the sprite. Because the element is as tall as the
   whole dig, its left/width stay valid at any scroll offset.

   Only left and width are kept. This used to also record the shaft's top and
   bottom in document space, plus a flag for the position:fixed phone layout,
   so it could answer shaftTopScreen()/shaftBottomScreen() per frame without a
   layout read. Nothing needs that any more: the car's travel band is anchored
   to the viewport rather than to the shaft, because a band that slid up the
   screen at the scroll rate fought the travel and reversed the car's direction
   (see deck.js). Dropping it also drops a getComputedStyle() call from every
   re-measure. */
var shaftEl = document.querySelector('.dig__shaft');
var shaftX = 0, shaftW = 0;
/* The viewport size at the last shaft measurement, so a re-measure can tell a
   real resize from a late re-layout. */
var lastShaftW = 0, lastShaftH = 0;

function measureShaft() {
  if (shaftEl) {
    var r = shaftEl.getBoundingClientRect();
    shaftX = r.left;
    shaftW = r.width;
  }
  /* Fallback keeps the game playable if the shaft element is ever removed.
     The clamp guards the narrow case where the grid has not laid out yet. */
  if (!shaftW) {
    shaftW = clamp(viewW * 0.2, 120, 220);
    shaftX = (viewW - shaftW) / 2;
  }
  /* A genuinely new viewport means the old car position is meaningless, so
     park it in the middle of its band. A re-measure at the same size - the
     late layout shift from a font swap, which re-runs this on `load` and on
     document.fonts.ready - must NOT yank the car, so that case only re-clamps
     it back into the band and leaves it where the reader left it.

     Returns whether the viewport really changed, so main.js can pass the same
     decision on to deck.js. It cannot call seatDeck() itself: deck.js imports
     this module, so an import back the other way would be a cycle. */
  if (viewW !== lastShaftW || viewH !== lastShaftH) {
    lastShaftW = viewW;
    lastShaftH = viewH;
    return true;
  }
  return false;
}
/* === 3. Deterministic noise ==============================================
   Every decoration is generated from a fixed seed, so the rock never
   flickers between frames and looks identical on every reload. */
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
/* === 4. Baked textures ===================================================
   Each layer gets one small tile of pixel-block speckle, baked once at boot
   and reused as a repeating pattern. Far cheaper than drawing thousands of
   rects per frame, and it keeps the frame budget tiny. */
var TILE = 64;
var patterns = {};
/* The soil tile from assets.js, or null before it decodes. Set once, then
   buildTextures() is re-run. */
var dirtTile = null;
function setDirtTile(t) { dirtTile = t; }

function bakeTile(seed, count, light, dark, size) {
  var t = document.createElement('canvas');
  t.width = size; t.height = size;
  var g = t.getContext('2d');
  g.imageSmoothingEnabled = false;
  var rnd = mulberry32(seed);
  for (var n = 0; n < count; n++) {
    var x = Math.floor(rnd() * size);
    var y = Math.floor(rnd() * size);
    var s = rnd() < 0.75 ? 2 : 4;  /* 2px grit plus the odd 4px chunk */
    g.fillStyle = rnd() < 0.5 ? light : dark;
    /* Each speckle is drawn nine times, once per wrapped neighbour. Without
       this, a speckle landing on the right or bottom edge was sliced in half
       and never came back on the left, which is exactly what showed up as a
       faint grid over the rock where the tile repeated. The canvas clips the
       copies that fall outside the tile, so only the wrapped halves survive. */
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        g.fillRect(x + dx * size, y + dy * size, s, s);
      }
    }
  }
  return t;
}

/* The dirt tile from the sheet, or null while it is still decoding. Read from
   the assets module rather than imported as a live binding, because it is
   assigned once the fetch resolves and layers.js must not hold a stale null.
   setDirtTile() is called by main.js when that happens, and rebuilds the
   patterns - this function is idempotent and cheap, so calling it again is
   the whole re-bake story rather than a second code path. */
function buildTextures() {
  var i;
  for (i = 0; i < LAYER_DEFS.length; i++) {
    /* The sky is open air: no rock grit, so no pattern tile. */
    if (LAYER_DEFS[i].rock === 'sky') {
      patterns[LAYER_DEFS[i].id] = null;
      continue;
    }
    /* DIRT alone takes the pixel-art soil tile. It arrives as a 64px mirrored
       block, which is also TILE, so the scroll arithmetic in render.js
       (scrollY % TILE) still lines up with it exactly.

       The tile arrives already faded, so that the band gradient underneath
       still shows through it - see OPACITY in assets.js, which is where that
       decision belongs, next to the tint table it sits beside. */
    if (LAYER_DEFS[i].rock === 'dirt' && dirtTile) {
      patterns[LAYER_DEFS[i].id] = ctx.createPattern(dirtTile, 'repeat');
      continue;
    }
    patterns[LAYER_DEFS[i].id] = ctx.createPattern(
        bakeTile(1000 + i * 77, 150, 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.19)', TILE),
        'repeat');
  }
  patterns.far = ctx.createPattern(
    bakeTile(555, 60, 'rgba(255,255,255,0.030)', 'rgba(0,0,0,0.045)', 96), 'repeat');
  patterns.near = ctx.createPattern(
    bakeTile(313, 90, 'rgba(255,255,255,0.07)',  'rgba(0,0,0,0.26)',  64), 'repeat');
  /* There used to be a `patterns.ledge` tile here, scrolled with
     `scrollY % TILE` to give the old fixed floor some grit. It is gone with the
     floor itself: the car hangs in the shaft, so there is no rock mass beneath
     it to texture. Dropping it also removes a per-boot bake that nothing drew. */
}
/* The player sprite - the 16x16 grid, its palette and the bake - lives in
   avatar.js now, and is re-exported from the bottom of this file so that
   game.js, render.js and the tests keep importing it from here. It is not
   world geometry and never needed to be in this module. */
/* The shaft, as measured from the real grid column (see measureShaft).
   The player is walled into it, so rock always frames the sprite. */
function shaftLeft()  { return Math.round(shaftX); }
function shaftRight() { return Math.round(shaftX + shaftW); }
function shaftMid()   { return shaftX + shaftW / 2; }

/* On a phone the shaft is a narrow strip and the sprite would be wider than
   it, so the art is drawn down. imageSmoothingEnabled is off, so a scaled
   blit stays crisp rather than going blurry. */
function spriteScale() { return shaftW < 150 ? 0.6 : 1; }

/* === The shaft ============================================================
   The sprite stands in a mine shaft, walled in, so rock always frames it. The
   car floor, its travel band and the scroll mapping that drives it are NOT here:
   they moved to deck.js, which owns them because they are simulation state that
   changes every frame rather than world geometry that is measured once. */

/* Canvas half of the old resize(): layers.js owns the viewport numbers, so
   main.js cannot assign them. Order relative to main.js is unchanged. */
function resizeViewport() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);  /* cap: 3x costs a lot for no gain */
  /* clientWidth/Height exclude the classic scrollbar, so the canvas backing
     store matches the layout viewport exactly rather than being clipped. */
  viewW = document.documentElement.clientWidth;
  viewH = document.documentElement.clientHeight;
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  /* CSS size and backing-store size are kept separate: the backing store is
     in device pixels, the CSS box stays in layout pixels. */
  canvas.style.width = viewW + 'px';
  canvas.style.height = viewH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;   /* hard pixel edges when we scale up */
}

/* Public surface of this module. Collected here so that not one line of
   the code above needed a keyword added to it. */
export {
  canvas,
  ctx,
  clamp,
  DEEP,
  LAYER_DEFS,
  ROCK,
  SHAFT_TINT,
  layers,
  viewW,
  viewH,
  dpr,
  scrollY,
  syncScroll,
  metresPerPx,
  measure,
  layerIndexAt,
  activeLayerIndex,
  shaftX,
  shaftW,
  shaftLeft,
  shaftRight,
  shaftMid,
  measureShaft,
  mulberry32,
  makeNoise,
  seamNoise,
  seamY, seamPropY, seamVertexX, SEAM_STEP,
  TILE,
  patterns,
  buildTextures,
  setDirtTile,
  SPRITE_W,
  SPRITE_H,
  FRAME_MS,
  SPRITES,
  maxScroll,
  travelFrom,
  travelTo,
  spriteScale,
  resizeViewport
};
