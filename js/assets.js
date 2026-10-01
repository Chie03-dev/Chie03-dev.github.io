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
   not guessed: the tight bounding box of the non-transparent pixels, and the
   32px grid of the tileset. The tileset is a palette PNG of a 10x4 grid.

   'turf' and 'dirt' are 32x32 cells addressed in GRID UNITS (col,row); the
   rest are pixel rectangles. turf = a grass-topped dirt tile for the surface
   band, dirt = a plain dirt tile for the repeating rock texture.

   dirt is (2,1) rather than (4,2). Both are dirt, but the sheet's cells are not
   interchangeable: most have a hard vertical split - a lit rocky column down one
   side, shadow down the other. Mirrored into a 2x2 block (see mirrored()) that
   split lands on both axes at once and becomes a bold symmetric motif, and
   because every motif is the same shape the eye locks onto the 64px period
   immediately - the band read as a row of identical arches.

   (2,1) is the most evenly distributed cell: no edge split, just scattered
   pebbles, so mirroring it does not manufacture a shape out of nothing.

   The two cuts differ on purpose, because they are consumed differently:

     turf is SLICED, not mirrored, and stays 32px. Only the top 32px of it is
       ever visible - biome-sky.js draws a band exactly one cell tall - so the
       mirrored half below is never seen, while its effect on the visible half is
       real: mirroring flipped the sheet's wavy grass line onto itself and turned
       it into a hard chevron that repeated every 64px down the whole surface.
     dirt is MIRRORED to 64px, because it tiles a deep band vertically and its
       opposite edges genuinely have to meet. */
var CELLS = {
  tree:    { unit: false, cuts: [
    { key: 'tall',  x: 6,   y: 0,  w: 83, h: 96 },
    { key: 'small', x: 109, y: 24, w: 62, h: 72 } ] },
  bush:    { unit: false, cuts: [
    { key: 'bush',  x: 1, y: 16, w: 31, h: 16 } ] },
  grass:   { unit: false, cuts: [
    { key: 'tuft',  x: 8, y: 21, w: 16, h: 11 } ] },
  tileset: { unit: true, size: 32, cuts: [
    { key: 'turf', col: 0, row: 0, mirror: false },
    { key: 'dirt', col: 2, row: 1, mirror: true } ] }
};

/* Multiply tints, one per key. Each is chosen by eye against the ROCK table in
   layers.js rather than derived, because "muted enough to sit in the mine" is
   an art judgement and not a formula. Flipping one of these is the whole
   difference between the art matching the backdrop and popping out of it. */
var TINT = {
  tall:  '#a8b184',   /* foliage -> the olive of a canopy in shadow   */
  small: '#a8b184',
  bush:  '#9fb07d',
  tuft:  '#9fb07d',
  turf:  '#b9ad7e',   /* grass + dirt -> desaturated, cooled          */
  dirt:  '#a08a80'
};

var assets = {
  trees: [],        /* sliced tree canvases                            */
  bushes: [],       /* sliced bush canvases                           */
  tufts: [],        /* sliced grass-tuft canvases                     */
  turf: null,       /* one 32px grass-topped tile, for the surface    */
  dirt: null,       /* one 64px seamless tile, for the rock pattern   */
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
/* A 2x2 mirrored tile, seamless on both axes BY CONSTRUCTION.

   Worth stating plainly, because it was measured rather than assumed: no 32px
   tile in tilesetgrass.png satisfies the wrap test (edge column equal to its
   opposite neighbour) except five, and all five are flat single-colour padding
   rather than dirt. So the sheet cannot be tiled directly - doing it anyway is
   what puts a visible grid over the rock. Mirroring the source into a 2x2
   block makes opposite edges identical by definition, which needs no
   cross-fade and no blending, and the 64px period lines up with TILE in
   layers.js so the existing scroll arithmetic still holds.

   Note the top-left quadrant is drawn straight from the sheet, so the source
   rect is needed here; `raw` alone only holds the mirrored neighbours. */
function mirrored(img, cut, cell) {
  var n = cell, raw = surface(n * 2, n * 2), g = raw.g;
  var sx = cut.col * n, sy = cut.row * n;
  /* top-left quadrant, straight from the sheet */
  g.drawImage(img, sx, sy, n, n, 0, 0, n, n);
  /* top-right mirrored horizontally */
  g.save();
  g.translate(n * 2, 0); g.scale(-1, 1);
  g.drawImage(img, sx, sy, n, n, 0, 0, n, n);
  g.restore();
  /* bottom half mirrored vertically from the finished top half */
  g.save();
  g.translate(0, n * 2); g.scale(1, -1);
  g.drawImage(raw.c, 0, 0, n, n, 0, 0, n, n);
  g.restore();
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
/* The pixel-art soil is drawn ON TOP of a per-band gradient, and the baked
   grit tiles all get their depth from that gradient underneath - a band is
   lighter at its top and darker at its bottom purely because of it.

   The tileset PNG is fully opaque, though, so used as-is it painted over the
   gradient and flattened the whole dirt band into one flat brown, losing the
   falloff every other band has. So the tile is faded down before it is handed
   over.

   The number is low on purpose. This tile repeats every 64px down a band that
   can be thousands of pixels tall, so a high-contrast tile stamps itself over
   the whole shaft and the repetition becomes the thing you notice - the rock
   stops reading as depth and starts reading as wallpaper. At this level the
   pebbles still read as pixel art and the gradient still clearly sits on top.

   turf is NOT faded: the grass line is a hard edge against the sky and the dirt
   body below it is meant to be solid. */
var OPACITY = { dirt: 0.15 };

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

function harvest(name, img) {
  var spec = CELLS[name], out = {};
  for (var i = 0; i < spec.cuts.length; i++) {
    var c = spec.cuts[i], spr;
    if (spec.unit && c.mirror !== false) spr = mirrored(img, c, spec.size);
    else if (spec.unit) spr = cell(img, c, spec.size);
    else spr = slice(img, c);
    out[c.key] = fade(spr, OPACITY[c.key]);
  }
  return out;
}
/* One grid cell, cropped to its 32px square. Used where the result is drawn in a
   band exactly one cell tall, so there is no opposite edge to match and no reason
   to pay for the mirrored version. */
function cell(img, cut, size) {
  var s = surface(size, size);
  s.g.drawImage(img, cut.col * size, cut.row * size, size, size, 0, 0, size, size);
  return tint(s.c, TINT[cut.key] || '#ffffff');
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
   same file, rather than a naming convention the code assumes. */
var SHEETS = {
  tree:    'tree.png',
  bush:    'bush.png',
  grass:   'grass.png',
  tileset: 'tilesetgrass.png'
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
    if (got.bush)  assets.bushes = [got.bush.bush];
    if (got.grass) assets.tufts  = [got.grass.tuft];
    if (got.tileset) {
      assets.turf = got.tileset.turf;
      assets.dirt = got.tileset.dirt;
    }
    assets.loaded = true;
    /* ok means "the pixel art is live", so it is only true when BOTH tiling
       tiles landed: dirt and turf are drawn every frame and have no per-object
       fallback, unlike the foliage arrays which just stay empty. */
    assets.ok = !!(assets.turf && assets.dirt && assets.trees.length && assets.tufts.length);
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
