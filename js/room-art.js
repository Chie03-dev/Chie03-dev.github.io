/* ==========================================================================
   room-art.js - what a side room looks like
   ==========================================================================
   PURPOSE. Draws a side room: back wall, floor, ceiling and the props that make
   each layer's room look like that layer rather than like the same box four
   times. Separate from rooms.js, which owns GEOMETRY and knows nothing about
   how anything looks, and separate from render.js, which is already past the
   500-line cap this repo works to.

   WHAT IS DELIBERATELY NOT HERE. No parallax, no torch flicker, no animated
   lighting. The bottom cave has all of that in cave-scene.js and it is right
   there: these rooms are seen in passing, while scrolling between the panels
   above and below them, and motion behind text is the thing this page has to
   get right. A still room reads as rock; a moving one reads as wallpaper.

   THE PALETTE IS THE LAYER'S, NOT THE ROOM'S. Each room is drawn with the
   tint its own layer key names, which is the same key the shaft bands and the
   depth rail already use. So a room cannot drift out of step with the layer it
   belongs to, and adding a layer colours its room for free.
   ========================================================================== */

/* Tint per layer key, matching the band colours the rest of the renderer uses.
   The three values are the wash over the back wall, the floor fill and the
   highlight line along the top of the floor - kept together so a room cannot
   have a floor that does not belong to its wall. */
var TINT = {
  dirt:    { wall: '#3a2f24', floor: '#241d16', lip: '#6b563c' },
  stone:   { wall: '#33383d', floor: '#22262a', lip: '#5d6672' },
  caves:   { wall: '#2b3038', floor: '#1b1f25', lip: '#4e5865' },
  bedrock: { wall: '#262a30', floor: '#171a1f', lip: '#454c57' }
};
var FALLBACK = TINT.caves;

/* Deterministic per-room prop placement. Seeded from the room's index and its
   layer key so a prop is in the same place on every reload and on every
   re-measure - the reader should not find the ore face has moved because they
   resized the window. */
function propRnd(seed) {
  var s = seed >>> 0 || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

/* A hash of the layer key, so two rooms on DIFFERENT layers never share a
   layout even though both are seeded from their index. Without it, rooms 0 and
   2 would draw identical props, which reads as a bug even though both are
   correct in isolation. */
function hashLayer(layer) {
  var h = 2166136261;
  var s = String(layer || '');
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* A small block of rock, drawn as a stepped shape rather than a plain
   rectangle: at the sizes these are drawn, a flat rect reads as a UI element
   rather than as stone, and the step is what says "rock". */
function drawRubble(ctx, x, y, w, h, fill, lip) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = lip;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  /* One darker notch at the foot, so the block has a base and does not float. */
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(x + 2, y + h - 2, w - 2, 2);
}


/* Draw one room. `b` is the wall box from rooms.js bounds(), `floorY` and
   `roofY` are its screen-space floor and roof, `layer` is its palette key.

   Every x here is bounded by `b`, which is the room's own column. That is what
   stops the art spilling out across the text panel beside it: the room is
   narrower than the page by construction, and nothing in this function is
   allowed to forget that. */
function drawRoom(ctx, layer, b, floorY, roofY, index) {
  if (!isFinite(floorY) || !isFinite(roofY)) return;
  var t = TINT[layer] || FALLBACK;
  var w = Math.max(0, b.right - b.left);
  if (!(w > 0)) return;

  /* --- back wall: a wash, lighter at the top so the room has a direction to
     it. A gradient rather than a flat fill because a flat rectangle of the
     same colour as the band behind it disappears completely, which is what
     happened before the wash was added. */
  var top = Math.min(roofY, floorY);
  var g = ctx.createLinearGradient(0, top, 0, floorY);
  g.addColorStop(0, t.wall);
  g.addColorStop(1, t.floor);
  ctx.fillStyle = g;
  ctx.fillRect(b.left, top, w, floorY - top);

  /* --- ceiling: a ragged lower edge, so the room is cut into rock rather than
     boxed. Overlapping blocks on a seeded step - it is static, so it costs
     nothing and reads as a roof rather than as a line. */
  var r = propRnd(0x51DE ^ hashLayer(layer) ^ (index * 2654435761));
  var step = 18;
  ctx.fillStyle = t.floor;
  for (var x = b.left; x < b.right; x += step) {
    var d = 6 + Math.round(r() * 12);
    ctx.fillRect(x, roofY, step + 1, d);
  }

  /* --- props, drawn BEFORE the floor line so the floor always reads as the
     ground they stand on rather than being cut through by them --- */
  var count = 3 + Math.floor(r() * 2);
  for (var i = 0; i < count; i++) {
    var px = b.left + Math.round(r() * Math.max(1, w - 26));
    var pw = 14 + Math.round(r() * 16);
    var ph = 10 + Math.round(r() * 14);
    drawRubble(ctx, px, floorY - ph, pw, ph, t.floor, t.lip);
  }

  /* --- the floor, and its lit lip ---
     The lip is the one bright thing in the room and it is drawn ON TOP of
     everything else, because it is the only line the reader needs to read the
     room's geometry: without it there is no visual cue for where the ground is
     and the player appears to hover. */
  ctx.fillStyle = t.floor;
  ctx.fillRect(b.left, floorY, w, 18);
  ctx.fillStyle = t.lip;
  ctx.fillRect(b.left, floorY - 2, w, 3);

  /* --- walls: two vertical edges closing the room off. Drawn last so nothing
     can overlap them, and exactly on the bounds the collision uses, so the
     visible wall and the solid wall are the same line rather than two lines
     that happen to be near each other. */
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = t.lip;
  ctx.fillRect(b.left, roofY, 2, floorY - roofY);
  ctx.fillRect(b.right - 2, roofY, 2, floorY - roofY);
  ctx.globalAlpha = 1;
}


/* Exported in a block rather than inline on the function, for the same reason
   contact.js documents: the module loader and the graph check in tools/smoke.mjs
   both work on the block form, and an inline export is left unrewritten and
   becomes a syntax error the moment the file is evaluated. */
export { drawRoom };
