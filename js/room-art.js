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


/* The ENTRANCE: a doorway in the wall facing the shaft, drawn as a lit opening
   with a short passage running out of the room toward the shaft column.

   `side` is +1 when the room is left of the shaft (door on its right wall) and
   -1 when it is right of the shaft (door on its left wall). The passage is
   drawn OUTWARD from the wall, in that direction, which is why the sign matters:
   drawing it the wrong way puts the tunnel inside the room and the opening on
   the far side, so the reader would appear to walk out through solid rock.

   Drawn BEFORE the walls below, so the walls can be interrupted by it - see the
   note on that call. A door drawn on top of a solid wall reads as a poster. */
function drawEntrance(ctx, t, b, floorY, roofY, side) {
  if (!side) return;
  /* The opening is tall enough to walk through and narrow enough to read as a
     door. Its bottom sits ON the floor rather than near it, so the player
     standing in the room is standing in the doorway, not beside a hole. */
  var w = 46;
  var h = Math.min(120, Math.max(64, floorY - roofY - 20));
  var y = floorY - h;
  var x = side > 0 ? b.right - w / 2 : b.left - w / 2;

  /* The passage: a darker rectangle running from the opening away from the
     room, which is what sells "this goes somewhere" rather than "this is a
     painted rectangle". */
  var passW = 34;
  var px = side > 0 ? x + w / 2 - passW / 2 : x - passW / 2;
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(px, y, passW, h);

  /* The opening itself, lit from within. Warmer than the room, because the shaft
     is the one warm thing on the page and this is the way back to it. */
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = t.lip;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  /* A vertical jamb on each side, so the door has a frame rather than being an
     outline drawn on a rectangle. */
  ctx.fillStyle = t.lip;
  ctx.globalAlpha = 0.75;
  ctx.fillRect(x - 3, y, 3, h);
  ctx.fillRect(x + w, y, 3, h);
  ctx.globalAlpha = 1;
}

/* THE MAZE.

   Cross-walls running from the ceiling down, each with a GAP at one end, and the
   gap alternating top/bottom along the room. That single rule is what makes a run
   of walls read as a maze rather than as a row of pillars: each wall forces you
   past it on the opposite side from the last, so the free path snakes instead of
   running straight. Two walls make a corridor; four make a maze.

   Drawn as rock with the gap left OUT rather than as a wall with a hole cut in
   it, because clearRect would show the page through the wall and the wall is
   supposed to be solid.

   EVERY PLACEMENT IS SEEDED from the room's own rng, so a given room has the same
   maze on every reload and two rooms never share one. A shared seed would make all
   four rooms identical, which looks like a bug even though each is correct alone.

   THE ENTRANCE THIRD IS LEFT CLEAR. side > 0 means the door is on the right, so
   the maze occupies the left and the walk in is unobstructed: a maze whose first
   move is blocked reads as broken rather than as a puzzle. */
function drawMaze(ctx, t, b, floorY, roofY, r, side) {
  var w = b.right - b.left;
  if (!(w > 40)) return;

  var wallW = 16;
  var gap = 74;                  /* clear floor between one wall and the next */
  var reach = Math.floor((w - 80) / (gap + wallW));
  if (reach < 1) return;

  var startX = side > 0 ? b.left + 6 : b.left + Math.round(w * 0.34);
  var h = floorY - roofY;

  for (var k = 0; k < reach; k++) {
    /* THE RNG IS ACTUALLY USED HERE, and the first version of this function did
       not use it at all. Every wall sat at a fixed offset from the last, so all
       four galleries had the identical maze and differed only by which wall the
       door was on - while the comment above them claimed each room's maze was
       seeded and distinct. Building four identical rooms and writing that they
       were distinct is worse than not bothering, and a mutation that gave every
       room one shared seed PASSED the suite, because the shared seed changed
       nothing the test could see.

       So the jitter is real: each wall's offset and its gap height come from the
       room's own generator, which is seeded from its layer and index. Same maze
       on every reload; a different maze in every room. */
    var x = startX + k * (gap + wallW) + (r() * 22 - 11);
    if (x + wallW > b.right - 6) break;

    /* Alternate which end the gap is at, and flip every third wall so the run
       does not read as a printed zigzag. */
    var gapAtTop = (((k + (side > 0 ? 1 : 0)) % 2 === 0) !== (k % 3 === 0));
    var gapH = Math.min(110, Math.max(52, h * (0.28 + r() * 0.16)));
    var gapY = gapAtTop ? roofY : floorY - gapH;

    /* The solid part: the whole wall except the gap band. */
    ctx.fillStyle = t.floor;
    if (gapAtTop) ctx.fillRect(x, roofY + gapH, wallW, h - gapH);
    else ctx.fillRect(x, roofY, wallW, h - gapH);
    /* A lit edge on the leading side, matching the floor's lip, so the maze reads
       as the same rock as the room rather than as flat black boxes. */
    ctx.fillStyle = t.lip;
    ctx.globalAlpha = 0.32;
    ctx.fillRect(x, roofY, 2, h);
    ctx.globalAlpha = 1;
  }
}

/* Draw one room. `b` is the wall box from rooms.js bounds(), `floorY` and
   `roofY` are its screen-space floor and roof, `layer` is its palette key and
   `side` is which wall the entrance is in (+1 right, -1 left, 0 none).

   Every x here is bounded by `b`, which is the room's own column - with the one
   deliberate exception of the entrance's passage, which is drawn OUTSIDE b on
   purpose, because a doorway that stops at the wall is a doorway to nowhere.
   That is the point at which the shaft is. */
function drawRoom(ctx, layer, b, floorY, roofY, index, side) {
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

  /* THE MAZE, drawn after the ceiling and before the floor so the floor line and
     its lip always read as the ground the walls stand on. */
  drawMaze(ctx, t, b, floorY, roofY, r, side);

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
     that happen to be near each other.

     THE WALL WITH THE ENTRANCE IN IT IS INTERRUPTED. Drawing a continuous wall
     and then drawing a door over the top of it gives a poster on a wall - the
     most convincing-looking version of this feature being broken, because the
     doorway is right there and the player still cannot get through it. So the
     entrance wall is drawn as two segments with the opening left out between
     them, and the entrance is drawn into the gap.

     The gap is the same width and position entranceX/entranceSide report, taken
     from those rather than recomputed here: collision and art must agree on
     where the hole is, or the player walks into a wall that looks open. */
  var doorHalf = 26;
  var doorX = side > 0 ? b.right : b.left;
  var gapLo = doorX - doorHalf;
  var gapHi = doorX + doorHalf;

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = t.lip;
  /* Far wall: always solid. */
  ctx.fillRect(side > 0 ? b.left : b.right - 2, roofY, 2, floorY - roofY);
  /* Near wall: split around the doorway when there is one. */
  if (side) {
    var near = side > 0 ? b.right - 2 : b.left;
    if (gapLo > near) ctx.fillRect(near, roofY, gapLo - near, floorY - roofY);
    if (gapHi < near + 2) ctx.fillRect(gapHi, roofY, near + 2 - gapHi, floorY - roofY);
  } else {
    ctx.fillRect(near, roofY, 2, floorY - roofY);
  }
  ctx.globalAlpha = 1;

  drawEntrance(ctx, t, b, floorY, roofY, side);
}


/* Exported in a block rather than inline on the function, for the same reason
   contact.js documents: the module loader and the graph check in tools/smoke.mjs
   both work on the block form, and an inline export is left unrewritten and
   becomes a syntax error the moment the file is evaluated. */
export { drawRoom };
