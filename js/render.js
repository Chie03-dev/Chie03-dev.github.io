/* ==========================================================================
   render.js - every pixel of the canvas art
   ==========================================================================
   The pixel-rect helper, the ambient dust motes and all of the world drawing:
   parallax speckle, the layer bands and their motifs, the sky, the shaft, the
   hoist and the mine car, the player, the foreground.

   Reads player state from game.js, world state from layers.js and car state
   from deck.js, and draws. It never mutates the player, and it never mutates
   the car: the motion preference is imported from deck.js as a live binding so
   that the art and the movement cannot disagree about it.

   Everything here is drawn with code. There are no image files in this project.
   ========================================================================== */

import {
  ctx, viewW, viewH, DEEP, ROCK, layers, scrollY, activeLayerIndex,
  shaftLeft, shaftRight, spriteScale,
  TILE, patterns, seamY, mulberry32, SHAFT_TINT, SPRITES, FRAME_MS
} from './layers.js';
import { groundY, deckBounds, sheaveY, reduced } from './deck.js';
import { player } from './game.js';
import { drawBiomes, drawSurfaceProps } from './biomes.js';
/* The cave's geometry and the constants its art is drawn from. Imported here
   rather than recomputed, so the rubble and the ore land on the SAME floor steps
   the collision samples - two consumers of one profile that disagree about
   where to read it is the meadow-twitch bug, and this is the same trap with
   rocks on it. */
import {
  caveActive, screenFloorY, caveRnd,
  CAVE_FLOOR_STEP, CAVE_RUBBLE_SEED, CAVE_VEIN_SEED
} from './cave.js';
/* The four side rooms: geometry from rooms.js, appearance from room-art.js.
   Aliased on import because render.js already has a screenFloorY and a bounds
   in scope from cave.js, and a second unaliased one would shadow it silently -
   which is precisely how the bottom cave's floor would end up being sampled
   with the side room's function. */
import {
  roomLayer, visibleRooms, entranceSide, screenFloorY as roomFloorY,
  bounds as roomBounds, roofY as roomRoof
} from './rooms.js';
import { drawRoom } from './room-art.js';
/* The cage at the foot of the shaft. Its geometry is drawn from the same
   functions the collision reads - cageFloorY() in particular - so the plate the
   player lands on and the plate that is painted cannot be two different lines. */
import { cageActive, cageFloorY, cageSpan } from './cage.js';
/* The shaft's timber structure and lamps. Structure is drawn before the rails and
   the lamps after them, because the sets carry the guides and the lamps hang off
   them - the only ordering that makes the shaft read as built rather than decorated. */
import { drawTimberSets, drawBracing, drawShaftLamps } from './shaft-art.js';

/* The offscreen canvas the gallery creatures are drawn onto, so they can be
   counted separately from the rock around them. Created lazily on first render
   and reused at the viewport's size - see the note in render(). */
var mobLayer = null;
/* The cave drawn as a LEVEL: parallax backdrop, strata, crystals, torches,
   stalactites, the shelves themselves and the near foreground. It is its own
   module because render.js is already past the 500-line cap and no cave art may
   be added here. */
import {
  drawBackdrop, drawStrata, drawCrystals, drawTorches, drawStalactites,
  drawForegroundRocks
} from './cave-scene.js';

/* Tiny helper: draw one snapped, axis-aligned pixel rect. Snapping keeps
   edges crisp on HiDPI, where a fractional fill would blur a whole pixel. */
function px(x, y, w, h, colour) {
  ctx.fillStyle = colour;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
/* === Dust motes ==========================================================
   Ambient life in the shaft. Seeded so the initial scatter is stable, then
   wrapped (not re-randomised wholesale) to avoid a visible pop. */
var motes = [];
function seedMotes() {
  motes = [];
  var rnd = mulberry32(777);
  for (var i = 0; i < 44; i++) {
    motes.push({ x: rnd() * viewW, y: rnd() * viewH, s: rnd() < 0.8 ? 1 : 2, v: 5 + rnd() * 14 });
  }
}
function drawMotes(dt) {
  if (reduced) return;               /* no ambient motion under reduced motion */
  for (var i = 0; i < motes.length; i++) {
    var m = motes[i];
    m.y -= m.v * dt;                 /* drift up = descending past the world */
    if (m.y < -4) { m.y = viewH + 4; }
    if (m.x < -4) m.x = viewW + 4; else if (m.x > viewW + 4) m.x = -4;
    px(m.x, m.y, m.s, m.s, 'rgba(255,255,255,0.13)');
  }
}
/* === World drawing =======================================================
   Layers are painted back to front: far speckle, then each layer band with
   its gradient + texture + motifs, then the shaft and its guide rails, the
   hoist and car, the player, the motes, the foreground strips, and a vignette.

   Parallax: a vertical scroll cannot shift a layer sideways, so depth is sold
   with speed instead. Background texture is locked to scrollY (1.0x, so the
   art stays welded to the copy); the far speckle drifts at 0.55x, the
   foreground strips at 1.9x. Under reduced motion every factor becomes 1.0x
   and the ambient bob/dust are skipped entirely. The car still travels under
   reduced motion - see deck.js - because that is the mechanic, not decoration. */
function pf(factor) { return reduced ? 1 : factor; }

function drawFar() {
  ctx.fillStyle = DEEP;
  ctx.fillRect(0, 0, viewW, viewH);
  if (!patterns.far) return;
  ctx.save();
  ctx.translate(0, -(scrollY * pf(0.55)) % 96);
  ctx.fillStyle = patterns.far;
  ctx.fillRect(0, 0, viewW, viewH + 96);
  ctx.restore();
}

/* `now` is the frame clock. It is forwarded to the biome painters because the
   sky animates (clouds drift, the sun arcs) and the rest of the art is welded to
   the world. The sky used to derive its motion from scrollY, which froze it
   solid whenever the reader stopped scrolling. */
/* Trace a layer's seam curve across the viewport, as a path ready for clip() or
   stroke(). The x step matches the one the seam is stroked at, so the clip edge
   and the drawn line are the same polyline and cannot disagree by a pixel.

   The curve is the layer's TOP boundary, jagged by +/-13px. Everything that is
   soil has to be clipped to below it; see drawBands. */
function seamPath(layer, step) {
  ctx.beginPath();
  for (var x = -40; x <= viewW + 40; x += step) {
    var y = seamY(layer, x);
    if (x === -40) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
}

function drawBands(now) {
  var i, layer, bandTop, bandBottom, grad, key;
  for (i = 0; i < layers.length; i++) {
    layer = layers[i];
    if (layer.bottom - scrollY < -40 || layer.top - scrollY > viewH + 40) continue;

    bandTop = layer.top - scrollY;
    bandBottom = layer.bottom - scrollY;
    key = ROCK[layer.rock];

    var step = 1;
    var isSky = layer.rock === 'sky';

    /* The sky is open air: its wash is not soil, so it is not clipped to the
       seam - the surface biome owns everything down to the soil line, and the
       dirt band below paints its own clipped soil over the top of it. */
    if (isSky) {
      grad = ctx.createLinearGradient(0, bandTop, 0, bandBottom);
      grad.addColorStop(0, key.top);
      grad.addColorStop(1, key.bot);
      ctx.fillStyle = grad;
      ctx.fillRect(-40, bandTop, viewW + 80, bandBottom - bandTop + 2);
      biomesDrawn += drawBiomes(layer, i, bandTop, bandBottom, now);
      continue;
    }

    /* Everything below this point is SOIL, and all of it is clipped to below
       the seam curve.

       The bug this fixes: the gradient and the grit both filled from bandTop,
       which is a STRAIGHT line, while the seam that is stroked along the top of
       the band is a jagged curve +/-13px around it. So wherever the curve dipped
       below bandTop, soil was painted over the band edge and the grass line was
       drawn on top of the dirt rather than under it - a strip of soil sitting
       ABOVE the green line, most obvious on the surface layer where that line
       is the grass. The surface read as a green rule with dirt hanging over it.

       Clipping to the curve makes the seam the top of the soil everywhere, so
       the line is always the boundary. The dirt band is the one that matters -
       it is the only band with a coloured seam - but the clip is applied to
       every rock band so no band can show its own grit above its own edge. */
    ctx.save();
    seamPath(layer, step);
    ctx.lineTo(viewW + 40, bandBottom + 4);
    ctx.lineTo(-40, bandBottom + 4);
    ctx.closePath();
    ctx.clip();

    grad = ctx.createLinearGradient(0, bandTop, 0, bandBottom);
    grad.addColorStop(0, key.top);
    grad.addColorStop(1, key.bot);
    ctx.fillStyle = grad;
    ctx.fillRect(-40, bandTop, viewW + 80, bandBottom - bandTop + 2);

    /* Rock grit, scrolling 1:1 with the world. */
    ctx.save();
    ctx.translate(0, -(scrollY % TILE));
    ctx.fillStyle = patterns[layer.id];
    ctx.fillRect(-40, bandTop + (scrollY % TILE), viewW + 80, bandBottom - bandTop + 2);
    ctx.restore();

    ctx.restore();          /* release the soil clip */

    /* Two-tone jagged seam along the top of the band, drawn AFTER the clip is
       released so the line itself is never cut in half by its own curve. */
    seamPath(layer, step);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.stroke();
    seamPath(layer, step);
    var x2;
    for (x2 = -40; x2 <= viewW + 40; x2 += step) {
      var y2 = seamY(layer, x2) - -10;
      if (x2 === -40) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
    }
    ctx.lineWidth = 10;
    /* Dirt is the surface layer, so its seam is the grass line. */
    ctx.strokeStyle = (i === 1) ? 'rgba(122,186,96,0.85)' : 'rgba(255,255,255,0.14)';
    ctx.stroke();

    biomesDrawn += drawBiomes(layer, i, bandTop, bandBottom, now);
  }
}

function drawShaft() {
  var l = shaftLeft(), r = shaftRight();
  var layer = layers[activeLayerIndex()];

  /* Darken the cleared column so text and player read against the rock. */
  ctx.fillStyle = 'rgba(8,10,14,0.55)';
  ctx.fillRect(l, -20, r - l, viewH + 40);
  ctx.fillStyle = SHAFT_TINT[layer ? layer.rock : 'caves'] || 'rgba(0,0,0,0.2)';
  ctx.fillRect(l, -20, r - l, viewH + 40);

  /* The shaft's STRUCTURE, behind the machine: timber sets across the walls and
     the cross-bracing between them. Drawn here, before the rails, because the
     guides are bolted to the sets - they have to read as being in front of the
     frame, or the shaft looks like a graphic laid over a hole. See
     js/shaft-art.js, which is its own module because render.js is already over
     the 500-line cap and no new art goes in here. */
  drawTimberSets(l, r);
  drawBracing(l, r);

  /* Wall faces. */
  px(l - 7, -20, 7, viewH + 40, 'rgba(255,255,255,0.10)');
  px(r, -20, 7, viewH + 40, 'rgba(0,0,0,0.38)');

  /* Guide rails down the shaft, replacing the old ladder. The two vertical webs
     are the rails; the short plates bolted across them at a fixed 26px rhythm
     are the rail joints. They are the strongest cue that the world is moving,
     because the car crossing a joint is the only thing in frame that moves
     against them - and it is what makes the car read as travelling rather than
     as a bar sliding up and down. */
  var railA = l + 12, railB = r - 15;
  px(railA, -20, 3, viewH + 40, 'rgba(0,0,0,0.42)');
  px(railB, -20, 3, viewH + 40, 'rgba(0,0,0,0.42)');
  px(railA, -20, 1, viewH + 40, 'rgba(255,255,255,0.10)');
  var step = 26, off = ((scrollY % step) + step) % step, y;
  for (y = -step + off; y < viewH + step; y += step) {
    /* Joint plate, then a bolt head so it reads as fastened metal. */
    px(railA - 2, y, 7, 4, 'rgba(0,0,0,0.46)');
    px(railB - 2, y, 7, 4, 'rgba(0,0,0,0.46)');
    px(railA - 2, y, 7, 1, 'rgba(255,255,255,0.13)');
    px(railB - 2, y, 7, 1, 'rgba(255,255,255,0.13)');
    px(railA, y + 1, 1, 1, 'rgba(255,255,255,0.22)');
    px(railB, y + 1, 1, 1, 'rgba(255,255,255,0.22)');
  }

  /* The lamps go LAST, in front of everything else in the shaft, because they hang
     off the sets and light the rock in front of them. Drawn earlier they would sit
     behind the rails, which puts a light source behind a solid object - the one
     ordering that cannot be defended. Their pools are deliberately faint: they are
     there to give the shaft depth, not to light it. */
  drawShaftLamps(l, r);
}

/* How many times the mine car was actually drawn this frame. A DIRECT check,
   replacing an older one that compared total rect counts between the cave frame
   and a shaft frame - a proxy that said "the cave draws less than the shaft, so
   the car is gone". It worked until the cave gained real art, at which point it
   would have started failing for a reason having nothing to do with the car.

   This counts the thing itself: drawCar() increments it. 0 in the cave means the
   car is provably not drawn, however much art surrounds it, and however much art
   is added later. Exported for tools/smoke.mjs, which asserts both directions. */
var carDrawn = 0;

/* Counts drawPlayer() the same way carDrawn counts drawCar().

   Added with the soil-line gate, because gating the car without gating the sprite
   would delete the platform and leave the reader standing on nothing - and the
   smoke suite could not see that, since a mutated sprite gate left every existing
   assertion green. The sprite has to be counted to be assertable at all. */
var playerDrawn = 0;

/* ==========================================================================
   Everything below is what makes the thing on the deck read as a MINE CAR
   rather than as a lit line. Three parts, drawn back to front: the headgear at
   the top of the shaft (a sheave wheel and its bracket), the cables running
   down to the car, and the car itself.

   The cables are the load-bearing idea. A cable's length is the car's position
   expressed as a distance from the sheave, so as the car travels the cables
   visibly stretch and slacken. Nothing else in the frame moves vertically at
   the same rate, so the eye reads cause and effect even though the car is the
   only thing being animated.

   The counterweight is the reason the cables exist at all. It runs the
   opposite way in its own channel: car at the top of the band means weight at
   the bottom, and the moment you scroll it swaps over. That inverse motion is
   the cheapest possible way to make a mechanism look like it obeys physics
   rather than like a tween.

   The headgear is anchored to the top of the car's travel band rather than to
   the shaft mouth. It was world-anchored first, which meant it scrolled off the
   top of the screen a few hundred pixels into the page and the hoist was just a
   pair of ropes running out of frame for everything below that. Pinning it to
   the top of the band keeps the whole machine - wheel, bracket, ropes, car -
   framed at all times, and the rope length is still honestly the distance from
   the sheave down to the car. */
function drawHoist() {
  var l = shaftLeft(), r = shaftRight();
  var y = groundY();
  var b = deckBounds();
  var mid = (l + r) / 2;
  var sheave = sheaveY();

  /* The player has left the car. Once they are in a room there is nobody riding
     it, and a car drawn hanging in mid-air over the room with an empty floor
     under it reads as a bug rather than as a mechanism. The shaft walls stay -
     they still frame the room's mouth - but the hoist goes.

     Gated on where the player actually IS rather than on caveActive(): those are
     not the same question. caveActive() is about where the reader has scrolled
     to; inCave is about where the player is, and it is the one movePlayer()
     decides. Drawing the car based on the scroll would hide it while the player
     was still standing on it.

     `inRoom !== -1` is the SAME check applied to the four side rooms. Without it
     the car would vanish the moment the reader scrolled a room into view, even
     though the player was still aboard it - the car is the reader's transport
     and it is what they are standing in until a room actually takes them. */
  if (player.inCave) return;

  /* Car parked below the foot of the screen: nothing of this is visible. */
  if (y > viewH + 40) return;

  /* --- Sheave wheel and bracket, above the top of travel ------------------- */
  var wheelR = 9;
  /* Bracket: two bars straddling the wheel, bolted across the shaft. */
  px(l + 2, sheave - 4, r - l - 4, 3, 'rgba(0,0,0,0.50)');
  px(l + 2, sheave + 1, r - l - 4, 3, 'rgba(0,0,0,0.50)');
  /* Wheel: three stacked bars make a blocky disc, which stays pixel-aligned
     instead of going soft and antialiased the way an arc would. */
  px(mid - wheelR, sheave - 2, wheelR * 2, 5, 'rgba(0,0,0,0.62)');
  px(mid - wheelR + 2, sheave - 5, wheelR * 2 - 4, 11, 'rgba(0,0,0,0.62)');
  px(mid - wheelR + 4, sheave - 3, wheelR * 2 - 8, 7, 'rgba(255,210,74,0.16)');
  /* Hub and spokes, so the wheel reads as something that turns. */
  px(mid - 1, sheave - 1, 2, 2, 'rgba(255,255,255,0.30)');
  px(mid - wheelR + 2, sheave - 1, wheelR * 2 - 4, 1, 'rgba(255,255,255,0.10)');
  px(mid - 1, sheave - wheelR + 1, 1, wheelR * 2 - 2, 'rgba(255,255,255,0.10)');

  /* --- Cables -------------------------------------------------------------
     Two taut lines from the wheel down to the car's lifting eyes. Dotted
     rather than solid so they read as chain at this pixel scale, and stepped
     in 2px so the per-frame cost stays trivial. Both runs are bounded because
     the sheave is anchored to the top of the travel band, which is on screen. */
  var carY = y - 3;
  for (var c = sheave + 6; c < carY; c += 2) {
    px(mid - 3, c, 1, 1, 'rgba(255,210,74,0.20)');
    px(mid + 3, c, 1, 1, 'rgba(255,210,74,0.20)');
  }
  /* Where the cables meet the car. */
  px(l + 16, carY - 4, 5, 2, 'rgba(0,0,0,0.55)');
  px(r - 21, carY - 4, 5, 2, 'rgba(0,0,0,0.55)');

  /* --- Counterweight ------------------------------------------------------
     Mirrored through the band: car at the top means weight at the bottom. The
     span guard matters because a pathological viewport can invert the band, and
     a mirrored position would then run the weight off the screen entirely. */
  var span = b.bot - b.top;
  var weightY = y;
  if (isFinite(span) && span > 0) {
    weightY = b.top + (b.bot - y);
    if (weightY < b.top - 20 || weightY > b.bot + 20) weightY = (b.top + b.bot) / 2;
  }
  var wx = r - 9;
  /* Its own short cable, so the weight is visibly hung rather than floating.
     Bounded for the same reason as the hoist ropes: the sheave is on screen. */
  if (weightY > sheave + 10) {
    for (var w = sheave + 8; w < weightY - 8; w += 3) {
      px(wx, w, 1, 1, 'rgba(255,255,255,0.13)');
    }
  }
  px(wx - 3, weightY - 8, 7, 16, 'rgba(0,0,0,0.55)');
  px(wx - 2, weightY - 7, 5, 14, 'rgba(255,255,255,0.07)');
  px(wx - 3, weightY - 2, 7, 1, 'rgba(255,255,255,0.14)');
  px(wx - 3, weightY + 2, 7, 1, 'rgba(255,255,255,0.14)');

  drawCar(y, l, r);
}

/* The car itself: a plate the sprite stands on, with side shoes riding the
   guides. The lit lip is drawn at EXACTLY the Y game.js resolves collision
   against - groundY() - so the sprite can neither float above the car nor sink
   into it. That shared number is the whole reason the two cannot drift apart.

   There is no rock floor beneath it any more, and that is deliberate: a car in
   a shaft hangs in the shaft. Painting a fixed mass of rock below the deck
   would imply a floor to stand on, which is exactly the thing this change
   removed. What is below is dark shaft, which is where the counterweight and
   the cables run.

   Clipped to the shaft box, so the plate and the weight never run out over the
   rock where the panel text sits. */
function drawCar(y, l, r) {
  carDrawn++;
  ctx.save();
  ctx.beginPath();
  ctx.rect(l - 8, 0, r - l + 16, viewH);
  ctx.clip();

  /* Underframe, drawn first so the deck plate overlaps its top edge. */
  px(l - 6, y + 2, r - l + 12, 4, 'rgba(0,0,0,0.60)');
  /* Side shoes: the blocks that grip the guide rails, one each side. */
  px(l + 10, y - 3, 7, 6, 'rgba(0,0,0,0.62)');
  px(r - 17, y - 3, 7, 6, 'rgba(0,0,0,0.62)');
  px(l + 11, y - 2, 5, 2, 'rgba(255,255,255,0.10)');
  px(r - 16, y - 2, 5, 2, 'rgba(255,255,255,0.10)');
  /* The deck: a solid plate with a lit top edge and a shaded body. */
  px(l - 8, y, r - l + 16, 2, 'rgba(255,210,74,0.28)');
  px(l - 8, y + 2, r - l + 16, 6, 'rgba(0,0,0,0.72)');
  px(l - 8, y + 2, r - l + 16, 1, 'rgba(255,255,255,0.12)');
  /* Rivet line along the plate, so the car has a front face. */
  for (var rivet = l - 4; rivet < r + 4; rivet += 9) {
    px(rivet, y + 5, 1, 1, 'rgba(255,255,255,0.10)');
  }
  ctx.restore();          /* release the shaft clip */
}

function drawPlayer(now) {
  /* No soil gate here, deliberately. An earlier version hid the sprite above the
     soil line, on the reasoning that it rides the car. That was solving the
     problem by deleting the evidence: the reader opened the page and the
     elevator was simply not there. The car is now parked ON the surface instead
     of being hidden above it (see carTarget() in deck.js), so the sprite rides
     it down to the ground and is drawn from the first screen of the page. */
  playerDrawn++;
  var moving = Math.abs(player.vx) > 4 || !player.onGround;
  var set = reduced ? [SPRITES.idle[0]] : (moving ? SPRITES.walk : SPRITES.idle);
  var img = set[Math.floor(now / FRAME_MS) % set.length];
  var k = spriteScale();
  var w = img.width * k, h = img.height * k;
  /* The sprite lives in the shaft, so it is centred on the shaft box rather
     than on the viewport. On a desktop layout the shaft is the middle column
     and those coincide; on a phone the shaft is a strip on the left edge. */
  var cx = player.x + player.w / 2, cy = player.y + player.h / 2;

  /* Lantern pool of light, drawn before the sprite. */
  var glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 130);
  glow.addColorStop(0, 'rgba(255,210,74,0.18)');
  glow.addColorStop(1, 'rgba(255,210,74,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 130, cy - 130, 260, 260);

  var bob = reduced ? 0 : Math.sin(now / 380) * 1.5;
  var x = Math.round(cx - w / 2);
  var y = Math.round(player.y + bob + (player.h - h) / 2);

  if (player.facing < 0) {
    /* Flip horizontally rather than authoring a second set of frames. */
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
}

function drawForeground() {
  var strip = 26;
  var off = (scrollY * pf(1.9)) % 64;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, strip, viewH);
  ctx.fillRect(viewW - strip, 0, strip, viewH);
  ctx.translate(0, -off);
  ctx.fillStyle = patterns.near;
  ctx.fillRect(0, 0, strip, viewH + 64);
  ctx.fillRect(viewW - strip, 0, strip, viewH + 64);
  ctx.restore();
  px(strip, 0, 2, viewH, 'rgba(0,0,0,0.5)');
  px(viewW - strip - 2, 0, 2, viewH, 'rgba(0,0,0,0.5)');
}

/* How many bands drew a biome in the last render(). Zero is the failure this
   exists to catch: before the stub geometry was fixed, every panel sat at the
   same left/width, gutters() correctly returned [], and every biome painter was
   skipped - so the whole module reported perfectly healthy while drawing
   nothing at all. */
var biomesDrawn = 0;
/* Trees placed by the props pass, tracked for the same reason: a pass that
   silently stops running must be visible to the smoke check, not invisible. */
var propsDrawn = 0;

/* === The bedrock cave =====================================================
   Drawn only while the player is actually in it (caveActive()), and drawn
   BEFORE the hoist and the player so the sprite stands on top of the floor
   rather than behind it.

   The floor is one polyline sampled at the same FLOOR_STEP the collision uses,
   which is what keeps the art and the physics reading one curve. Two consumers
   of a profile that disagreed about where to sample it is precisely the bug that
   made the meadow twitch, so it is worth being explicit that this loop and
   movePlayerCave() walk the same numbers.

   Three passes, back to front: the dark void, the rock mass below the floor
   line, then the lit detail - rubble catching the torchlight, and the ore veins.
   Detail is drawn AFTER the mass so it is not buried by it. */
/* THE VOID IS GONE, and that is the whole change.

   It used to paint an opaque #05070a -> #12171e gradient across the entire cave
   the moment caveActive() became true, which meant the DUNGEON BAND behind the
   cave - the rock biome every other layer is made of, and the one the sixth room
   is explicitly built from - was replaced the instant you entered the final
   layer. Entering the cave did not take you deeper into the same world; it
   swapped one world for another laid on top.

   So nothing is filled here any more. The band's own rock is what shows through
   the cave, and cave-scene.js draws its parallax backdrop, strata, crystals,
   torches and stalactites ON TOP of that band - which is exactly how every
   other layer's biome art works. The cave is now a room in the same world with
   the same rock, seen from the inside, rather than a separate world painted over
   the page.

   `caveActive()` is deliberately NOT imported: render.js already gates every
   call to this on it, and re-checking a second flag here would be a second gate
   reading the same thing. */
function drawCaveVoid() {
  /* Intentionally empty - see the comment above. Kept as a function rather than
     deleted at the call site so the render order still reads in one place, and
     so restoring a fill is one line here rather than a hunt through render(). */
}

function drawCave() {
  if (!caveActive()) return;

  /* The viewport width is the fallback, NOT window.innerWidth directly. The smoke
     harness drives the stub and innerWidth is 0 there for part of the run, and
     with w = 0 the sample loop below never executes, pts stays empty, and the
     first pts[0] read throws - which took render() down at three viewports. A
     cave that cannot be measured is a cave with nothing to draw, not a crash. */
  var w = viewW || window.innerWidth || 0;
  if (!(w > 0)) return;
  var step = CAVE_FLOOR_STEP;
  var pts = [], x;
  /* One extra step past the right edge, so the last segment reaches the edge
     rather than stopping short of it and leaving a gap of bare band. */
  for (x = 0; x <= w + step; x += step) {
    pts.push([x, screenFloorY(x)]);
  }
  if (pts.length < 2) return;

  /* How far the rock mass extends below the floor. Sized to the VIEWPORT rather
     than a fixed 400: the player is clamped into the cave's bounds and stood on
     this floor, and a mass that stopped short of the bottom of a tall window
     would leave them standing on the edge of nothing. */
  var deep = Math.max(viewH || 0, 400);


  /* --- the rock mass below the floor line --- */
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineTo(w + step, pts[pts.length - 1][1] + deep);
  ctx.lineTo(-step, pts[0][1] + deep);
  ctx.closePath();
  var rockGrad = ctx.createLinearGradient(0, pts[0][1], 0, pts[0][1] + 260);
  rockGrad.addColorStop(0, '#3a4450');
  rockGrad.addColorStop(0.35, '#232a33');
  rockGrad.addColorStop(1, '#0b0e12');
  ctx.fillStyle = rockGrad;
  ctx.fill();

  /* The lit top edge of the floor. One pixel of warm light along the line the
     player walks on is what sells the floor as a surface catching a torch,
     rather than as the boundary of a fill. */
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = 'rgba(196,214,236,0.20)';
  ctx.lineWidth = 2;
  ctx.stroke();

  /* --- rubble on the floor, at the profile's own steps --- */
  var r = caveRnd(CAVE_RUBBLE_SEED);
  for (i = 0; i < pts.length; i++) {
    if (i % 2) continue;                       /* every other step: half as many */
    /* bx/by, NOT px/py: `px` is the drawing helper imported from sprites.js, and
       a local var of the same name shadows it for the whole function - so the
       first rubble block would have called a number. */
    var bx = pts[i][0], by = pts[i][1];
    var rw = 5 + ((r() * 16) | 0);
    var rh = 3 + ((r() * 7) | 0);
    var lit = 0.10 + r() * 0.16;
    /* px() HERE is render.js's own five-argument helper - px(x, y, w, h, colour),
       which draws into the module's own ctx and does NOT take a context as its
       first argument. sprites.js has a second helper with the same name and a
       different signature, px(g, x, y, w, h, colour), which does. Passing ctx as
       the first argument here shifted every argument along by one, so the colour
       string landed in x and Math.round("rgba(...)") produced the NaN that the
       non-finite check caught. The two helpers sharing a name is the real hazard
       in this codebase; the smoke test's finite() reporting on fillRect is what
       turned a silently missing room into a named failure. */
    px(bx - rw / 2, by - rh, rw, rh, 'rgba(18,22,28,0.85)');
    px(bx - rw / 2, by - rh, rw, 1, 'rgba(190,206,226,' + lit.toFixed(3) + ')');
  }

  /* --- ore veins in the rock face, below the floor line --- */
  for (i = 0; i < pts.length; i += 3) {
    var pick = caveRnd(CAVE_VEIN_SEED + i);
    if (((pick() * 3) | 0) !== 0) continue;
    var vx = pts[i][0] + 20, vy = pts[i][1] + 26 + ((pick() * 90) | 0);
    var vw = 3 + ((pick() * 9) | 0);
    px(vx, vy, vw, 2, 'rgba(246,201,109,0.16)');
  }
}

/* The cave floor the player is standing on, lit by their lantern. Drawn after
   the mass so the pool of light lands on the rock rather than under it. */
function drawCaveLight() {
  if (!caveActive()) return;
  var cx = player.x + player.w / 2;
  var cy = screenFloorY(cx);
  var g = ctx.createRadialGradient(cx, cy, 6, cx, cy, 190);
  g.addColorStop(0, 'rgba(255,206,122,0.17)');
  g.addColorStop(0.55, 'rgba(255,190,110,0.06)');
  g.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - 190, cy - 190, 380, 380);
}

/* === The cage at the foot of the shaft ====================================
   Drawn with the cave and BEFORE the player, so the sprite stands on the plate
   rather than behind it - the same reason drawCave() runs where it does.

   It is an open steel frame, not a box: four corner posts, a lattice of bars on
   the back and sides, a solid plate to stand on, and a pair of guide shoes
   where the cage would meet the shaft's rails. Nothing here is a filled
   rectangle across the opening, because the player is meant to walk in under it
   and a solid back would hide them.

   Every Y is read from cageFloorY() - the collision's own number - so the
   painted lip is exactly the line the player is resolved against. That shared
   number is the same arrangement drawCar() has with groundY(), and for the same
   reason: two consumers of one fact that disagree is the seam twitch all over
   again. */
function drawCage() {
  if (!caveActive() || !cageActive()) return;
  var plate = cageFloorY();
  if (!isFinite(plate)) return;
  var s = cageSpan();

  /* Posts: the frame's four corners, standing from the plate down to whatever
     the floor happens to be beneath. The floor is sampled per post rather than
     assumed flat, so the cage is planted on the rock instead of hovering over
     the low point - which is exactly the failure the cage's own floor
     calculation exists to prevent, reproduced here if the two disagreed. */
  var postW = 5, inset = 3;
  var l = s.left + inset, r = s.right - inset - postW;
  var x, floorY;
  for (x = 0; x < 2; x++) {
    var postX = (x === 0) ? l : r;
    floorY = screenFloorY(postX + postW / 2);
    if (!isFinite(floorY) || floorY < plate) floorY = plate + 40;
    var len = floorY - plate;
    if (len > 0) {
      px(postX, plate, postW, len, 'rgba(12,16,21,0.88)');
      /* One lit edge per post, so the frame has a front face. */
      px(postX, plate, 1, len, 'rgba(255,255,255,0.13)');
      px(postX + postW - 1, plate, 1, len, 'rgba(0,0,0,0.45)');
    }
  }

  /* Back lattice: vertical bars at a fixed rhythm between the posts, and one
     horizontal rail a third of the way up. Sparse on purpose - the point is to
     read as a cage you can see through, and this is what lets the player behind
     it stay visible. */
  var top = plate - 3 - 34;
  var bar;
  for (bar = l + 8; bar < r; bar += 11) {
    px(bar, top, 2, 34, 'rgba(255,255,255,0.055)');
  }
  px(l, top + 16, r - l, 2, 'rgba(255,255,255,0.075)');

  /* The plate itself. The lit lip is drawn AT EXACTLY plate, the Y
     movePlayerCage() resolves against. */
  px(l - inset, plate, (r + postW) - l + inset * 2, 2, 'rgba(255,210,74,0.26)');
  px(l - inset, plate + 2, (r + postW) - l + inset * 2, 5, 'rgba(0,0,0,0.78)');
  px(l - inset, plate + 2, (r + postW) - l + inset * 2, 1, 'rgba(255,255,255,0.12)');
  /* Rivets, so the plate has a face rather than being a bar. */
  for (var rivet = l - inset + 4; rivet < r; rivet += 9) {
    px(rivet, plate + 4, 1, 1, 'rgba(255,255,255,0.10)');
  }

  /* Guide shoes, where the cage meets the shaft rails above it - the detail
     that ties this structure to drawCar()'s shoes and makes the two read as the
     same machine at two ends of its travel. */
  px(l - 2, plate - 5, 7, 5, 'rgba(0,0,0,0.70)');
  px(r - 5, plate - 5, 7, 5, 'rgba(0,0,0,0.70)');
  px(l - 1, plate - 4, 5, 1, 'rgba(255,255,255,0.12)');
  px(r - 4, plate - 4, 5, 1, 'rgba(255,255,255,0.12)');
}

function render(now) {
  biomesDrawn = 0;
  carDrawn = 0;
  playerDrawn = 0;
  ctx.fillStyle = DEEP;
  ctx.fillRect(0, 0, viewW, viewH);

  /* THE MOB LAYER, cleared before anything is drawn onto it and composited after
     the galleries. It exists so the creatures in the side rooms can be told apart
     from the rock they stand in - by the smoke suite, which counts only what is on
     this layer, and by the eye, which would otherwise be looking at a golem and
     four stalactites drawn in the same bucket.

     A real offscreen canvas rather than a flag: anything drawn to it has to be
     composited or it simply is not on the page, and an earlier version of this
     guarded the mob draw on the layer existing without ever creating one, which
     removed the creatures from the site entirely while every test stayed green.

     mobLayer is created lazily and reused - an offscreen canvas per frame is a
     per-frame allocation and a GC pause on a page that draws every frame. */
  if (!mobLayer || mobLayer.width !== viewW || mobLayer.height !== viewH) {
    mobLayer = document.createElement('canvas');
    mobLayer.width = viewW;
    mobLayer.height = viewH;
  }
  var mctx = mobLayer.getContext('2d');
  mctx.clearRect(0, 0, viewW, viewH);
  /* Handed to the room art for the duration of the gallery pass only. */
  ctx.mobLayer = mctx;

  drawFar();
  drawBands(now);
  /* Trees and bushes, AFTER the bands and BEFORE the shaft. The bands paint
     the soil over the sky band, so anything standing on the soil has to be
     drawn in this gap or the dirt buries the bottom of every trunk. Before the
     shaft because the shaft walls and their rails are nearer the reader than
     anything on the surface. */
  propsDrawn = drawSurfaceProps();
  /* The cave, back to front. The order is the whole depth stack, and it is easy to
     get backwards because "draw the far thing first" is the rule and the void is
     the farthest thing of all - yet the void is OPAQUE, so anything drawn before
     it is thrown away. That is not a theoretical hazard: the scene was originally
     drawn first and the void last, and an opaque black rectangle quietly buried
     the entire level.

     So, in order:
       void -> backdrop -> strata -> crystals/torches -> stalactites ->
       the rock mass and rubble -> the shelves -> the lantern pool -> the cage ->
       the player -> the near foreground.

     The void goes first because it is opaque. The rock mass goes after the scene
     because it sits BELOW the floor line, so the backdrop pillars stand in front
     of the dark and on top of the rock rather than the other way round. The near
     foreground is last so the reader passes BEHIND it.

     The parallax source is the SCROLL, not the player - see the note below. */
  /* PARALLAX IS KEYED TO THE PAGE, NOT TO THE PLAYER.

     It used to be `player.x + player.w / 2`, and the comment above it claimed
     that was deliberate and load-bearing: "the single change that turns this from
     a corridor into a level". It was deliberate. It was also the reason the reader
     reported, three separate times, that the rooms follow them.

     Every layer shifts as the player walks sideways, so the whole cave slid around
     them. That reads as the world tracking the character rather than the character
     moving through the world - which is the same complaint as the side rooms, from
     the same inversion, and I had diagnosed those correctly and left this one
     standing on the strength of a comment.

     Keying to scrollY keeps the thing parallax is FOR - nearer layers moving faster
     than distant ones as you descend - and drops the lateral tracking. Depth still
     reads. Nothing following you sideways is a real loss, and it is the correct
     trade for a page whose whole subject is descending.

     SCROLL IS HELD IN A LOCAL, not read inside the layers. Five separate
     functions each used to be handed px0; they now take one number derived here,
     so the source of the motion is decided in one place and cannot drift. */
  var px0 = window.scrollY || 0;
  drawCaveVoid();
  /* Every side room currently on screen, drawn shallowest first so the deeper
     one paints over the shallower where they overlap.

     Gated on visibleRooms() and NOT on player.inRoom. That was the popping: the
     art was drawn only while somebody was standing in the room, so it appeared
     and vanished with the character instead of being part of the page. The
     rooms are scenery in the document now, exactly like the panels they sit
     opposite - they are painted because that part of the page is on screen, and
     they scroll at the document's rate. Whether the player happens to be
     standing in one is a separate question, answered by movePlayer().

     Drawn BEFORE the shaft so the shaft's rock and the car's cables pass in
     front: a room is beside the shaft, not a replacement for it, and the reader
     is looking at both at once. */
  var vis = visibleRooms();
  for (var vi = 0; vi < vis.length; vi++) {
    var rm = vis[vi];
    drawRoom(ctx, roomLayer(rm), roomBounds(rm),
             roomFloorY(rm, (roomBounds(rm).left + roomBounds(rm).right) / 2),
             roomRoof(rm), rm, entranceSide(rm), now, reduced);
  }

  /* THE CREATURES, composited over the rock they stand in. Their own layer means
     the smoke suite can count them on their own, and it means they are painted
     LAST - over the stalactites and the boulders, which is what a thing living in
     a room should look like rather than buried in it.

     And the hook is taken back off the context afterwards. It is set for the
     gallery pass only, so a later draw that happens to reach the room code cannot
     quietly queue up creatures of its own. */
  if (mctx) ctx.drawImage(mobLayer, 0, 0);
  ctx.mobLayer = null;
  if (caveActive()) {
    drawBackdrop(px0);
    drawStrata();
    drawCrystals(px0);
    drawTorches(px0, now, reduced);
    drawStalactites(px0);
  }
  drawCave();       /* the rock mass and its rubble, over the scene's feet */
  drawCaveLight();
  drawCage();       /* the cage standing on the cave floor, under the player */
  drawShaft();
  drawHoist();     /* headgear, cables, counterweight and the car itself */
  drawPlayer(now);
  if (caveActive()) drawForegroundRocks(px0);
  drawForeground();

  /* Vignette, so panel text near the edges keeps its contrast. */
  var v = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.35,
                                   viewW / 2, viewH / 2, viewH * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, viewW, viewH);
}

/* Public surface of this module. Collected here so that not one line of
   the code above needed a keyword added to it. */
export {
  seedMotes,
  drawMotes,
  render,
  biomesDrawn,
  propsDrawn,
  carDrawn,
  playerDrawn
};
