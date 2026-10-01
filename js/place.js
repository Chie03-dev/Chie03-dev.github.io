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
   draw a sprite SMALLER than it is. scaleFor() is an integer magnifier that
   bottoms out at 1, so without this an 83px-wide sheet tree can only ever be
   drawn at 83px or 166px - and the desktop gutter is about 48px, so exactly one
   tree fitted per gutter and the meadow read as a hedge of two or three.

   The destination is rounded to whole pixels whatever the scale. A fractional
   destination makes a sprite drift against its own placement by a different
   sub-pixel amount each frame, which the tree-stability check in smoke.mjs reads
   as the trees moving. */
function blitOn(spr, x, base, room, wantW) {
  if (!spr) return;
  var k = (wantW && spr.width)
    ? Math.max(0.15, Math.min(2, wantW / spr.width))
    : scaleFor(spr, room);
  var w = Math.max(1, Math.round(spr.width * k));
  var h = Math.max(1, Math.round(spr.height * k));
  ctx.drawImage(spr, Math.round(x), Math.round(base - h), w, h);
}

export { scaleFor, blit, blitOn };
