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

   Depends on nothing, so the graph stays a chain with no cycles:
   layers <- deck <- game <- render, with ui and main sitting on top.
   ========================================================================== */

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
  var i, def, el, rect;
  layers = [];
  for (i = 0; i < LAYER_DEFS.length; i++) {
    def = LAYER_DEFS[i];
    el = document.getElementById(def.id);
    if (!el) continue;
    /* getBoundingClientRect + scrollY = absolute document position, which is
       correct no matter which ancestor happens to be the offsetParent. */
    rect = el.getBoundingClientRect();
    layers.push({
      id: def.id, name: def.name, rock: def.rock, el: el,
      top: Math.round(rect.top + (window.scrollY || 0)),
      height: Math.round(rect.height)
    });
  }
  for (i = 0; i < layers.length; i++) layers[i].bottom = layers[i].top + layers[i].height;
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
/* === 4. Baked textures ===================================================
   Each layer gets one small tile of pixel-block speckle, baked once at boot
   and reused as a repeating pattern. Far cheaper than drawing thousands of
   rects per frame, and it keeps the frame budget tiny. */
var TILE = 64;
var patterns = {};

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

function buildTextures() {
  var i;
  for (i = 0; i < LAYER_DEFS.length; i++) {
    /* The sky is open air: no rock grit, so no pattern tile. */
    patterns[LAYER_DEFS[i].id] = LAYER_DEFS[i].rock === 'sky'
      ? null
      : ctx.createPattern(
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
/* === 5. The player sprite =================================================
   A 16x16 string grid baked once into an offscreen canvas, then blitted.
   '.' is transparent. Each character maps to one palette colour. */
var PALETTE = {
  '.': null,        /* transparent      */
  'o': '#1b1a22',   /* outline          */
  'k': '#ffd24a',   /* helmet           */
  'l': '#fff6cf',   /* lamp glow        */
  's': '#e8b98a',   /* skin             */
  'e': '#2a2520',   /* eye              */
  'b': '#3a6ea5',   /* shirt            */
  'd': '#2b4a70',   /* shirt shadow     */
  'p': '#2b2b3a',   /* trousers         */
  'c': '#8a5a3c'    /* boots            */
};

/* Idle: standing, eyes open. */
var IDLE_A = [
  '................',
  '......oooo......',
  '....ookkkkoo....',
  '...okkklllkko...',
  '...okkkkkkkko...',
  '....ssssssss....',
  '....ssssesss....',
  '......oooo......',
  '...oobbbbbboo...',
  '...obbsbbsbbo...',
  '...obbbbbbbbo...',
  '...obbbbbbbbo...',
  '...obbbbddbbo...',
  '....oopppooo....',
  '....occoocco....',
  '................'
];
/* Idle blink: same pose, eyes shut. */
var IDLE_B = IDLE_A.slice();
IDLE_B[6] = '....sssoosss....';

/* Walk A: legs split, one arm forward. */
var WALK_A = IDLE_A.slice();
WALK_A[9]  = '...obbsbbbbso...';
WALK_A[13] = '..oopppppooo....';
WALK_A[14] = '..occooccooo....';
/* Walk B: legs swapped, opposite arm forward. */
var WALK_B = IDLE_A.slice();
WALK_B[9]  = '...osbbbbbbbo...';
WALK_B[13] = '....ooppppppoo..';
WALK_B[14] = '....occooccooo..';

var SCALE = 4;                        /* 16px of art -> 64px on screen */
var SPRITE_W = 16 * SCALE;
var SPRITE_H = 16 * SCALE;
var FRAME_MS = 120;                   /* sprite frame duration */

function bake(rows) {
  var c = document.createElement('canvas');
  c.width = 16 * SCALE;
  c.height = 16 * SCALE;
  var g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (var y = 0; y < rows.length; y++) {
    for (var x = 0; x < 16; x++) {
      var col = PALETTE[rows[y].charAt(x)];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }
  }
  return c;
}

/* Baked once at boot, so the per-frame cost is a single drawImage. */
var SPRITES = {
  idle: [bake(IDLE_A), bake(IDLE_B)],
  walk: [bake(WALK_A), bake(WALK_B)]
};
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
  TILE,
  patterns,
  buildTextures,
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
