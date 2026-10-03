/* ==========================================================================
   assets.js - the pixel-art sheets, sliced and tinted

   This is the ONE module in the project that reads an image file. Everything
   else draws with code, because code was the only option while the art was
   procedural. These four PNGs came out of assets/PixelArt/, and this is the
   seam where they enter the graph.

   Slicing, rather than handing the <img> straight to drawImage, is deliberate.
   Every placement helper in place.js reads spr.width/spr.height to work out an
   integer scale, and the smoke test asserts those are finite and positive. An
   HTMLImageElement reports 0x0 until it decodes, so passing one around would
   make scaleFor() return a garbage scale for the first frame and make the
   assertions fire on something that is not a bug. A slice is a canvas with
   real dimensions from the moment it exists, so every existing contract holds.

   Tinting: the sheets are bright platformer colours (#59c135 grass, #b86f50
   dirt) and the mine around them is muted slate and brown. Drawn raw they read
   as a sticker. Each slice is multiplied toward the mine palette and then
   re-masked with destination-in, because 'multiply' paints the transparent
   margin too and would otherwise box every sprite in a solid rectangle.

   Depends on nothing. That keeps it a leaf of the module graph and means it
   can be unit-loaded by the smoke test without dragging the canvas in.
   ========================================================================== */

var DIR = 'assets/PixelArt/';

/* Where each sprite lives INSIDE its sheet. These are measured from the files,
   not guessed: the tight bounding box of the non-transparent pixels.

   Only tree.png remains. The other sheets were removed because each put a
   visible repeating motif in front of the reader - a 64px period for the dirt
   tile, ~45 eye-level repeats for the grass cap - which read as a chain of the
   same shape rather than as ground. Their art is now drawn procedurally
   (bakeTile() in layers.js, the tuft and bush in sprites.js and biome-sky.js).

   Do not reintroduce a tiling sheet without checking its period against the
   viewport width. The sheets' cells are not interchangeable: most have a hard
   vertical split, so a tile chosen for the wrong cell tiles badly. */
var CELLS = {
  tree:    { unit: false, cuts: [
    { key: 'tall',  x: 6,   y: 0,  w: 83, h: 96 },
    { key: 'small', x: 109, y: 24, w: 62, h: 72 } ] }
};

/* Multiply tints, one per key. Each is chosen by eye against the ROCK table in
   layers.js rather than derived, because "muted enough to sit in the mine" is
   an art judgement and not a formula. Flipping one of these is the whole
   difference between the art matching the backdrop and popping out of it. */
var TINT = {
  tall:  '#a8b184',   /* foliage -> the olive of a canopy in shadow   */
  small: '#a8b184'
};

var assets = {
  trees: [],        /* sliced tree canvases                            */
  loaded: false,
  ok: false
};
var waiters = [];
function surface(w, h) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c: c, g: g };
}
/* Multiply a shape toward the palette, then restore its alpha.

   The two-step is the whole trick, and the ORDER plus the SOURCE are both
   load-bearing:

     'multiply' composites the fill over the WHOLE rectangle, transparent margin
     included, so on its own every sprite comes back with a solid tint-coloured
     box around it. That is exactly what happened - the meadow was full of
     khaki rectangles.

     'destination-in' then keeps only the pixels where the mask is opaque, which
     puts the alpha channel back. But the mask must be the ORIGINAL, untinted
     shape, not the canvas being tinted. Drawing `s.c` onto itself is what the
     code did, and it cannot work for two reasons: the spec makes drawing a
     canvas onto itself undefined, and even read as "the current pixels" it is
     far too late - by that point the multiply step has already made every
     pixel opaque, so the mask says "keep everything" and the box survives.

   So the shape is built on its own canvas first and passed in as an explicit
   mask. Nothing here ever draws a canvas onto itself. */
function tint(shape, colour) {
  var s = surface(shape.width, shape.height);
  var g = s.g;
  g.drawImage(shape, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = colour;
  g.fillRect(0, 0, s.c.width, s.c.height);
  /* `shape`, not s.c: the untinted sprite is the only thing that still knows
     where the sprite actually ends. */
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(shape, 0, 0);
  g.globalCompositeOperation = 'source-over';
  return s.c;
}
function slice(img, cut) {
  var raw = surface(cut.w, cut.h);
  raw.g.drawImage(img, cut.x, cut.y, cut.w, cut.h, 0, 0, cut.w, cut.h);
  return tint(raw.c, TINT[cut.key] || '#ffffff');
}
function loadImage(file) {
  return new Promise(function (resolve, reject) {
    if (typeof Image === 'undefined') { reject(new Error('no Image')); return; }
    var img = new Image();
    img.onload = function () {
      if (!(img.width > 0) || !(img.height > 0)) {
        reject(new Error(file + ' decoded to ' + img.width + 'x' + img.height));
        return;
      }
      resolve(img);
    };
    img.onerror = function () { reject(new Error(file + ' failed to load')); };
    img.src = DIR + file;
  });
}
/* The dirt tile that used to be faded down here is gone, and with it the reason
   for fading anything.

   It was the only entry, and it was faded to 0.15 for a specific reason worth
   keeping in mind for any future tile: it repeated every 64px down a band that
   can be thousands of pixels tall, and at full strength the repetition became
   the thing you noticed - the rock stopped reading as depth and started reading
   as wallpaper. That is the same failure as the grass cap, at a different scale,
   and it is the reason every tiled asset is now gone rather than merely restyled.

   So the map is empty: nothing is faded, nothing is tiled, and the rock grit is
   bakeTile()'s own speckle in layers.js, which is low contrast by construction
   because the gradient it sits on is what gives a band its depth. */
var OPACITY = {};

/* Composite a finished sprite down to `amount` alpha. Returns the original when
   there is nothing to do, so the common path allocates nothing extra. */
function fade(c, amount) {
  if (amount === undefined || amount >= 1) return c;
  var out = surface(c.width, c.height);
  out.g.globalAlpha = amount;
  out.g.drawImage(c, 0, 0);
  out.g.globalAlpha = 1;
  return out.c;
}

/* Every remaining cut is a plain rectangle, so harvest() has exactly one shape to
   deal with. It used to branch three ways - rectangle, single cell, and the
   mirrored or stripped grid-cell tiles - but the cell helpers existed only for
   the dirt tile and the grass cap, and both are gone. The seamless-tiling
   problem they solved is now solved by not tiling at all: the rock grit is baked
   per band by bakeTile() in layers.js and the grass is drawn as bands in
   biome-sky.js, so no sheet pixel is ever repeated. */
function harvest(name, img) {
  var spec = CELLS[name], out = {};
  for (var i = 0; i < spec.cuts.length; i++) {
    var c = spec.cuts[i];
    out[c.key] = fade(slice(img, c), OPACITY[c.key]);
  }
  return out;
}
/* Which file each SHEET KEY is actually stored in.

   These used to be assumed identical - the key was concatenated with '.png'.
   That quietly coupled the key in CELLS to the filename on disk, and the tileset
   key 'tileset' did not match 'tilesetgrass.png'. The 404 it produced was not
   visible: load() catches and falls back to the drawn art, which still renders,
   so the page looked completely normal while showing none of the new pixel art.
   A test asserting `ok` would have caught it; the earlier suites did not, because
   the stubbed Image resolved for every name it was asked for.

   So the filename is data, declared next to the crop rectangles that describe the
   same file, rather than a naming convention the code assumes.

   One file is listed now. A sheet belongs here only while CELLS above still has
   crops that read from it - fetching an unused sheet only decodes it. */
var SHEETS = {
  tree:    'tree.png'
};

/* Populate `assets`. Resolves even on failure: `ok` says whether the sheets
   arrived, and every caller has a procedural fallback, so a 404 on a static
   host degrades the art rather than taking the page down with it. */
function load() {
  /* allSettled, NOT all.

     The four sheets are independent: the trees are in tree.png and have nothing
     to do with the tileset. With all(), a single missing file rejected the whole
     array and every sheet was thrown away, so one typo cost all four assets and
     the page fell back to the drawn art while still looking fine. That is a
     strict downgrade: the other three sheets had already loaded successfully.

     allSettled collects each outcome and keeps what worked, so a broken sheet
     costs only itself. `ok` stays false when any sheet failed, so callers can
     still see that the set is incomplete. */
  var keys = Object.keys(SHEETS);
  var each = keys.map(function (n) {
    return loadImage(SHEETS[n]).then(function (img) {
      return { name: n, img: img };
    }).catch(function (err) {
      console.warn('sheet ' + SHEETS[n] + ' unavailable:', err && err.message);
      return { name: n, img: null };
    });
  });
  return Promise.all(each).then(function (results) {
    var got = {};
    for (var i = 0; i < results.length; i++) {
      if (!results[i].img) continue;
      /* A sheet can arrive and still fail to slice (a bad crop rect, a 0x0
         decode). That must not take down the sheets that were fine either. */
      try {
        got[results[i].name] = harvest(results[i].name, results[i].img);
      } catch (err) {
        console.warn('sheet ' + SHEETS[results[i].name] + ' could not be sliced:', err && err.message);
      }
    }
    if (got.tree)  assets.trees  = [got.tree.tall, got.tree.small];
    assets.loaded = true;
    /* ok means "the pixel art is live". The trees are the only thing that comes
       from a sheet now - the grass, the tufts and the rock grit are all drawn -
       so this is a plain "did the trees arrive" check. */
    assets.ok = !!assets.trees.length;
    if (!assets.ok) console.warn('pixel-art sheets incomplete, using the drawn art where missing');
  }).then(function () {
    /* Flush `ready()` waiters only once the promise is fully settled, so a
       callback never observes a half-populated `assets`: with per-sheet
       recovery, "settled" can now legitimately mean "some sheets, not all". */
    var w = waiters; waiters = [];
    w.forEach(function (cb) { cb(assets); });
    return assets;
  });
}
/* Run `cb` when the sheets have settled - immediately if they already have.
   Callers that only want the art should use this rather than reading `assets`
   at module load, which is always too early. */
function ready(cb) {
  if (assets.loaded) { cb(assets); return; }
  waiters.push(cb);
}
load();

export { assets, TINT, ready, load };
