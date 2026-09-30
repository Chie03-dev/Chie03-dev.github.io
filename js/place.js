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
   the only correct way to stand a tree on a horizon. */
function blitOn(spr, x, base, room) {
  if (!spr) return;
  var k = scaleFor(spr, room);
  ctx.drawImage(spr, Math.round(x), Math.round(base - spr.height * k),
                spr.width * k, spr.height * k);
}

export { scaleFor, blit, blitOn };
