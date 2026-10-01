/* ==========================================================================
   avatar.js - the player sprite, baked once from a 16x16 string grid
   --------------------------------------------------------------------------
   Moved out of layers.js verbatim, purely to keep that file under the 500-line
   cap. Nothing about the art or the baking changed: same palette, same four
   frames, same scale, still baked at module load so the per-frame cost is one
   drawImage. The character is not world geometry - it has no relationship to
   the bands, the shaft or the textures - so it never belonged in the module
   that owns those.

   No imports. The four frames are derived from a single IDLE_A by patching
   individual rows, which is why there is only one 16-line block of art here
   rather than four.
   ========================================================================== */

/* '.' is transparent. Each character maps to one palette colour. */
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

export { SPRITE_W, SPRITE_H, FRAME_MS, SPRITES };
