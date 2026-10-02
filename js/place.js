/* ==========================================================================
   Sprite placement: the three helpers every biome painter uses to put a baked
   sprite on screen at a size that fits the space it is meant to be framing.

   These live in their own module rather than in biomes.js because the sky
   painter has moved out to biome-sky.js, and it needs them too. Importing them
   back out of biomes.js would close a cycle (biomes.js imports biome-sky.js
   for the painter, biome-sky.js would import biomes.js for these).

   Nothing here knows what a biome is. That is the point: "shrink to fit, and
   stand it on the ground rather than hanging from the top-left corner" applies
   to a tree, a crystal and a bookcase alike.
   ========================================================================== */

import { ctx } from './layers.js';

function scaleFor(spr, room) {
  if (!spr) return 1;
  return Math.max(1, Math.min(2, Math.floor(room / spr.width) || 1));
}
function blit(spr, x, y, room) {
  if (!spr) return;
  var k = scaleFor(spr, room);
  ctx.drawImage(spr, Math.round(x), Math.round(y),
                spr.width * k, spr.height * k);
}
/* Blit with the sprite's FEET on `base` instead of its top-left corner. This is
   the only correct way to stand a tree on a horizon.

   `wantW` is an optional target width in CSS pixels, and it is the only way to
   draw a sprite at a chosen size. scaleFor() is an integer magnifier that
   bottoms out at 1, so without this an 83px-wide sheet tree can only ever be
   drawn at 83px or 166px - and the desktop strip used to be about 48px, so
   exactly one tree fitted and the meadow read as a hedge of two or three.

   MAGNIFICATION IS QUANTIZED, and the reason is that imageSmoothingEnabled is
   off. Below 1x that is exactly right: nearest-neighbour downscaling keeps every
   edge hard, and that is how every sprite on this page is drawn. ABOVE 1x an
   arbitrary factor is not - at 1.33x some source columns are drawn twice and
   their neighbours once, so the pixel grid goes visibly uneven and a trunk
   develops a stripe. Snapping to the nearest HALF-step (1.0x, 1.5x, 2.0x) makes
   the doubling a regular 2-1-2-1 alternation instead, which reads as deliberate
   pixel art rather than as a resampling fault.

   NEAREST, not up. Rounding up was tried first and it is worse than it sounds:
   an 86px target is 1.04x of an 83px crop, so rounding up to 1.5x drew it at
   125px - 45% larger than the caller asked for, and the smallest entry in
   TREE_W came out the same size as the largest. The set of sizes the painter
   believes it is choosing stops being the set of sizes on screen. Nearest keeps
   the error within a quarter and preserves the intended spread.

   That quantization is also what lets TREE_W exceed the source crop size. The
   sheet crops are only 83x96 and 62x72, so without it no tree could ever be
   drawn larger than the art it came from.

   The destination is rounded to whole pixels whatever the scale. A fractional
   destination makes a sprite drift against its own placement by a different
   sub-pixel amount each frame, which the tree-stability check in smoke.mjs reads
   as the trees moving. */
function blitOn(spr, x, base, room, wantW) {
  if (!spr) return;
  var k;
  if (wantW && spr.width) {
    k = wantW / spr.width;
    if (k > 1) k = Math.max(1, Math.round(k * 2) / 2);
  } else {
    k = scaleFor(spr, room);
  }
  var w = Math.max(1, Math.round(spr.width * k));
  var h = Math.max(1, Math.round(spr.height * k));
  ctx.drawImage(spr, Math.round(x), Math.round(base - h), w, h);
}

export { scaleFor, blit, blitOn };
