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

/* THE CAVE. Stalactites, stalagmites and an irregular roof.

   This replaced a maze, and the maze was wrong in a way worth recording. Evenly
   spaced cross-walls with a neat gap at one end are ARCHITECTURE - they read as
   something built, because that is what even spacing and a regular gap are. A
   cave is the opposite: irregular, clustered, and mostly empty. The complaint
   was accurate.

   What a cave actually looks like, and what is drawn here:
     - a roof whose underside is ragged rather than a line, in overlapping lumps
       of differing depth;
     - STALACTITES hanging from it, in clusters, each one a stack of narrowing
       blocks so it tapers instead of ending in a flat edge;
     - STALAGMITES rising off the floor to meet them, always shorter than the
       stalactite above - they form at the same rate from both surfaces and the
       drip side wins, which is why a cave ceiling is spikier than its floor;
     - a few BOULDERS, wider than the spires and low, because fallen rock is
       what is actually lying about in a cave;
     - and mostly NOTHING, which is the part that makes the rest read as a cave.
       A cave with something in every square metre looks furnished.

   DRAWN AS BLOCKS, not triangles. Everything on this page is pixel art and a
   smooth gradient-filled cone would be the one thing on screen that is not.

   THE ENTRANCE THIRD IS LEFT CLEAR, as before. side > 0 means the door is on the
   right, so the formations occupy the far side and the walk in is unobstructed.

   EVERYTHING IS SEEDED from the room's own generator - seeded from its layer and
   index - so a given cave is the same cave on every reload, and no two rooms are
   the same cave. A cave that reshuffles while you look at it is not a cave. */
function drawCave(ctx, t, b, floorY, roofY, r, side) {
  var w = b.right - b.left;
  if (!(w > 40)) return;
  var h = floorY - roofY;
  var lo = side > 0 ? b.left + 6 : b.left + Math.round(w * 0.36);
  var hi = side > 0 ? b.right - Math.round(w * 0.36) : b.right - 6;
  if (!(hi > lo)) return;

  /* A SPIRE: a stack of narrowing blocks, so it tapers. Drawn from its tip back
     to its root, widest first, which is what gives the stepped silhouette. */
  function spire(x, tipY, len, baseW, fill, lip) {
    var steps = Math.max(2, Math.round(len / 7));
    for (var s2 = 0; s2 < steps; s2++) {
      var f = s2 / steps;
      var sw2 = Math.max(2, Math.round(baseW * (1 - f * 0.78)));
      ctx.fillStyle = fill;
      ctx.fillRect(x - Math.round(sw2 / 2), tipY + s2 * 7, sw2, 8);
    }
    ctx.fillStyle = lip;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(x - Math.round(baseW / 2), tipY, 2, len);
    ctx.globalAlpha = 1;
  }

  /* STALACTITES, hanging from the roof. Clustered: a run of 2-4 close together
     with a gap, because water finds the same crack and a lone drip every 60px
     is a comb, not a cave. */
  var clusters = 1 + Math.floor(r() * 2);
  for (var c = 0; c < clusters; c++) {
    var cx = lo + r() * (hi - lo);
    var n = 1 + Math.floor(r() * 2);
    for (var j = 0; j < n; j++) {
      var sx = cx + (r() - 0.5) * 46;
      if (sx < lo || sx > hi) continue;
      var len = Math.round(h * (0.12 + r() * 0.24));
      spire(sx, roofY, len, 7 + Math.round(r() * 6), t.floor, t.lip);
    }
  }

  /* STALAGMITES, off the floor, and always SHORTER than the ceiling spikes.
     That asymmetry is the single detail that most makes a cave read as a cave
     rather than as a set of columns: give them matching heights and you have
     pillars, which is architecture again. */
  var m = 1 + Math.floor(r() * 2);
  for (var q = 0; q < m; q++) {
    var mx = lo + r() * (hi - lo);
    if (mx < lo || mx > hi) continue;
    var mlen = Math.round(h * (0.08 + r() * 0.16));
    spire(mx, floorY - mlen, mlen, 8 + Math.round(r() * 7), t.floor, t.lip);
  }

  /* BOULDERS. Wide, low and blocky - fallen rock, not drip stone. */
  var nb = 1 + Math.floor(r() * 2);
  for (var bq = 0; bq < nb; bq++) {
    var bx = lo + r() * (hi - lo);
    var bw = 22 + Math.round(r() * 40);
    if (bx + bw > b.right - 4) break;
    var bh = 8 + Math.round(r() * 14);
    drawRubble(ctx, bx, floorY - bh, bw, bh, t.floor, t.lip);
  }
}

/* === The mobs ==============================================================
   One resident per gallery, and they are all different on purpose: this is a
   showcase, so the point is that a reader scrolling past sees four caves and four
   things living in them rather than four caves and the same rubble.

     ore gallery  - BAT, hanging from the roof. Wings out, upside down.
     stone chamber- GOLEM, standing. Squat, heavy, two lit eyes.
     deep cave    - SPIDER, low and wide. Eight legs, small body.
     bedrock      - WORM, segmented, half-buried. The oldest layer.

   Drawn AS BLOCKS like everything else on this page, and each one is a handful of
   rectangles - not because that is all there is room for, but because this is
   pixel art and a smooth sprite would be the one thing on screen that is not.

   EYES ARE THE ONLY LIT THING IN ANY OF THEM. Every mob has them and they use the
   accent colour, so at a glance you can tell what is in the dark before you can
   make out its shape. That is most of what makes a small creature read as alive
   rather than as a prop.

   Placement is seeded from the room, so a given mob stands in the same place on
   every reload. A creature that hops around between frames is not a resident. */
var MOBS = ['bat', 'golem', 'spider', 'worm'];

function drawMob(ctx, t, kind, x, floorY, r, h) {
  var eye = '#ffd24a';
  var dark = '#0d1116';

  function body(w, bh, dx) {
    ctx.fillStyle = dark;
    ctx.fillRect(x + dx - Math.round(w / 2), floorY - bh, w, bh);
  }
  function eyes(dx, y, gap, size) {
    ctx.fillStyle = eye;
    ctx.fillRect(Math.round(x + dx - gap), y, size, size);
    ctx.fillRect(Math.round(x + dx + gap - size), y, size, size);
  }

  if (kind === 'bat') {
    /* Hangs from the roof, so its y comes down from the top, not up off the
       floor - which is the whole difference between a bat and a beetle. */
    var len = Math.round(h * 0.24);
    var y0 = floorY - len;
    /* wings */
    ctx.fillStyle = dark;
    ctx.fillRect(x - 22, y0 + 4, 12, 4);
    ctx.fillRect(x + 10, y0 + 4, 12, 4);
    ctx.fillRect(x - 26, y0 + 8, 6, 3);
    ctx.fillRect(x + 20, y0 + 8, 6, 3);
    /* body + head */
    ctx.fillRect(x - 5, y0, 10, 12);
    ctx.fillRect(x - 4, y0 - 7, 8, 8);
    eyes(0, y0 - 5, 3, 2);
  } else if (kind === 'golem') {
    var gh = Math.round(h * 0.34);
    body(34, gh, 0);
    /* a second, wider block underneath reads as legs without drawing legs */
    ctx.fillStyle = dark;
    ctx.fillRect(x - 20, floorY - Math.round(gh * 0.34), 12, Math.round(gh * 0.34));
    ctx.fillRect(x + 8, floorY - Math.round(gh * 0.34), 12, Math.round(gh * 0.34));
    /* shoulders */
    ctx.fillRect(x - 22, floorY - gh - 6, 44, 8);
    eyes(0, floorY - gh - 2, 7, 3);
  } else if (kind === 'spider') {
    var sy = floorY - 14;
    ctx.fillStyle = dark;
    /* legs first, so the body sits on top of them */
    for (var i = 0; i < 4; i++) {
      var lx = x - 16 + i * 10;
      var dy = 6 + (i % 2) * 4;
      ctx.fillRect(lx, sy - dy, 3, dy + 14);
    }
    ctx.fillRect(x - 11, sy - 5, 22, 14);
    ctx.fillRect(x - 7, sy - 11, 14, 8);
    eyes(0, sy - 9, 4, 2);
  } else {
    /* WORM: segments marching along the floor, the last one smaller. */
    ctx.fillStyle = dark;
    var wx = x - 26;
    for (var s = 0; s < 5; s++) {
      var sw2 = 16 - s * 2;
      var sh = 12 - s;
      ctx.fillRect(wx, floorY - sh, sw2, sh);
      wx += sw2 - 3;
    }
    eyes(0, floorY - 11, 3, 2);
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

  /* The cave formations, after the ceiling and before the floor, so the floor
     line and its lip always read as the ground everything stands on. */
  drawCave(ctx, t, b, floorY, roofY, r, side);

  /* THE MOB, standing in the room. Its x is jittered off the room's own rng, so
     it is in the same place every reload without being dead centre - a creature
     posed in the middle of a shot looks like a sprite sheet, not like something
     living there. Inset from both walls so it never reads as part of the
     masonry. */
  {
    var mh = floorY - roofY;
    var mx = Math.round(b.left + 70 + r() * Math.max(1, (b.right - b.left) - 150));
    drawMob(ctx, t, MOBS[index % MOBS.length], mx, floorY, r, mh);
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
     visible wall and the solid wall are the same line rather than two lines that
     happen to be near each other.

     BOTH WALLS ARE SOLID. There used to be a doorway here: the near wall was
     split around a gap and an entrance was drawn into it, and the gap was taken
     from entranceSide() so the art and the collision could not disagree. All of
     that is gone - the rooms have no doors, so they are sealed galleries you look
     into rather than places you arrive at. The walls are now two plain lines.

     A side room is scenery. The reader cannot walk into it, so a door was a
     promise the page could not keep, and a sealed wall is honest about that. */
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
