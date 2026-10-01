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
}

/* === The hoist ============================================================
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

function render(now) {
  biomesDrawn = 0;
  ctx.fillStyle = DEEP;
  ctx.fillRect(0, 0, viewW, viewH);
  drawFar();
  drawBands(now);
  /* Trees and bushes, AFTER the bands and BEFORE the shaft. The bands paint
     the soil over the sky band, so anything standing on the soil has to be
     drawn in this gap or the dirt buries the bottom of every trunk. Before the
     shaft because the shaft walls and their rails are nearer the reader than
     anything on the surface. */
  propsDrawn = drawSurfaceProps();
  drawShaft();
  drawHoist();     /* headgear, cables, counterweight and the car itself */
  drawPlayer(now);
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
  propsDrawn
};
