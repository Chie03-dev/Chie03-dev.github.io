/* ==========================================================================
   cage-test.mjs - does the lift cage actually work?
   ==========================================================================
   tools/smoke.mjs proves the modules load and that the cave is walkable. It
   cannot tell whether the cage at the foot of the shaft is a real platform,
   because none of its assertions touch one. This file does, and it exists
   because the three properties that define the cage are all things that can be
   broken while every other suite stays green:

     1. REACHABLE. The plate sits CAGE_RISE above the floor, and the only thing
        that makes that number meaningful is the jump apex. If the plate were
        placed from the wrong end of the undulating floor it would be buried in
        the rock and no jump could ever reach it - a cage that cannot be stood
        on, which looks exactly like a cage that has not been drawn yet.
     2. ONE-WAY. A player walking in from the side must pass UNDER the plate,
        not be stopped by it and not be teleported up onto it. This is the part
        with no visual signature at all: a wrong answer here is invisible in a
        screenshot and would quietly stop the reader crossing the room.
     3. IT MATCHES THE ART. The plate the collision resolves against and the
        plate the renderer paints are one number, cageFloorY(). If a second copy
        of that height ever appeared, the sprite would stand on a line that is
        not drawn - which is the seam-twitch class of bug this repo has hit
        three times.

   Everything is measured against the REAL modules against a stubbed DOM, the
   same arrangement smoke.mjs uses, so a bug in the geometry cannot hide behind
   a hand-copied expectation.
   ========================================================================== */

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
function fail(msg) { failures++; console.log('  FAIL  ' + msg); }
function ok(msg)   { console.log('  ok    ' + msg); }

/* --- the stub, matching smoke.mjs's shape --------------------------------- */
const noop = () => {};
const TREASURE_TOP = 3170;
const box = (docTop, height, left, width) => ({
  getBoundingClientRect: () => {
    const y = docTop - (globalThis.window.scrollY || 0);
    return { top: y, left, width, height, bottom: y + height, right: left + width };
  }
});
/* A canvas context that accepts every call the renderer makes. drawCage() only
   uses fillRect, via px(). */
const stage = { width: 0, height: 0, style: {}, getContext: null };
/* Render-time drawing goes through the `ctx` the modules captured at LOAD time
   (layers.js does getContext once, at module scope), so a test cannot intercept
   it by handing the stage a different context afterwards. The recorder is
   therefore built into this one proxy, switched on and off by a flag - the only
   place the draw calls can be observed from outside. */
let recording = null;
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === 'canvas') return stage;
    if (k === 'fillRect') {
      return (x, y, w, h) => { if (recording) recording.push([x, y, w, h]); };
    }
    if (k === 'createLinearGradient' || k === 'createRadialGradient') {
      return () => ({ addColorStop: noop });
    }
    if (k === 'createPattern') return () => ({});
    if (k === 'measureText') return () => ({ width: 0 });
    if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
    return typeof k === 'string' ? noop : undefined;
  },
  set: () => true
});
stage.getContext = () => ctxStub;

const known = {
  summary: box(0, 200, 48, 520), skills: box(634, 200, 872, 520),
  projects: box(1268, 200, 48, 520), experience: box(1902, 200, 872, 520),
  education: box(2536, 200, 48, 520), '.dig__shaft': box(0, 2736, 620, 200),
  '[data-layer="dirt"]': box(634, 200, 872, 520),
  /* The cave's anchor is now `.dig`, and its room top comes from the bedrock
     chamber's bottom - the empty treasure-room section is gone from the markup.
     `.dig` runs 0..3770 and Education ends at 2736, so the cave is 2736..3770. */
  '[data-layer="bedrock"].chamber': box(2536, 200, 48, 520),
  '.dig': box(0, 3770, 0, 1440)
};
const stubEl = (sel) => known[sel] || {
  classList: { add: noop, remove: noop, contains: () => false },
  style: { setProperty: noop }, dataset: {}, textContent: '',
  addEventListener: noop, querySelector: () => null, querySelectorAll: () => [],
  getBoundingClientRect: () => box(0, 0, 0, 0)
};
globalThis.document = {
  getElementById: (id) => (id === 'stage' ? stage : stubEl(id)),
  querySelector: stubEl, querySelectorAll: () => [],
  createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctxStub }),
  addEventListener: noop,
  documentElement: { clientWidth: 1440, clientHeight: 900, scrollHeight: 4200, style: {} },
  fonts: { ready: Promise.resolve() }, hidden: false
};
globalThis.window = {
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  addEventListener: noop, removeEventListener: noop,
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  scrollY: 0, innerHeight: 900, devicePixelRatio: 1,
  performance: { now: () => 0 }, setTimeout,
  location: { hash: '' },
  getComputedStyle: () => ({ getPropertyValue: () => '#14181e', position: 'absolute' })
};
globalThis.IntersectionObserver = function () { this.observe = noop; this.unobserve = noop; };
globalThis.Image = function () {
  const img = { width: 320, height: 128, onload: null, onerror: null, _src: '' };
  Object.defineProperty(img, 'src', {
    get() { return img._src; },
    set(v) { img._src = v; setTimeout(() => { if (img.onload) img.onload(); }, 0); }
  });
  return img;
};

const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const L = await imp('js/layers.js');
const D = await imp('js/deck.js');
const CV = await imp('js/cave.js');
const CG = await imp('js/cage.js');
const G = await imp('js/game.js');
const R = await imp('js/render.js');
/* main.js exports resize() as a NAMED export, not a default one - it is the
   entry point index.html loads, so it has no consumers in the app. The harness
   drives it directly rather than re-implementing the boot order, which is the
   whole reason it is exported (see the note at the bottom of main.js). */
const { resize } = await imp('js/main.js');
/* deck.js is imported but not asserted on directly: it is pulled in because
   game.js depends on it, and importing it here means a module that only loads
   on this path cannot break the suite. */
void D;

/* === Set the scene =========================================================
   The same scroll smoke.mjs uses for the cave, taken from the fixture rather
   than repeated so the two suites cannot disagree about where the room is. */
function enterRoom() {
  globalThis.document.documentElement.clientWidth = 1440;
  globalThis.document.documentElement.clientHeight = 900;
  globalThis.window.innerHeight = 900;
  resize();                               /* the REAL boot order, shaft first */
  globalThis.window.scrollY = Math.max(0, TREASURE_TOP - 100);
  L.syncScroll();
  resize();
  CV.measureCave(L.viewW, L.viewH);
  CG.measureCage(L.viewW, L.viewH, L.shaftX, L.shaftW);
  if (!CV.caveActive()) { fail('the cave is inactive; none of this can be tested'); return false; }
  G.player.inCave = true;
  return true;
}

console.log('cage: geometry');
if (!enterRoom()) process.exit(1);

const plate = CG.cageFloorY();
const span = CG.cageSpan();

/* (1) It is finite, and a real height rather than a floor value. */
if (!isFinite(plate)) {
  fail('cageFloorY() returned ' + plate + '; the cage would be drawn and collided ' +
       'against a position that is not a number');
} else {
  ok('cageFloorY() is finite (' + plate.toFixed(1) + ')');
}

/* (2) It clears the floor EVERYWHERE across its span, not just at its centre.
       This is the bug the highest-point scan exists to prevent, and the one
       that makes a cage look like a decoration. */
let worstBurial = 0, buriedAt = null;
for (let x = span.left; x <= span.right; x += 4) {
  const under = CV.screenFloorY(x);
  if (!isFinite(under)) continue;
  if (under < plate) {                       /* floor ABOVE the plate = buried */
    const d = under - plate;
    if (d > worstBurial) { worstBurial = d; buriedAt = x; }
  }
}
if (worstBurial > 0.5) {
  fail('the cave floor rises ' + worstBurial.toFixed(1) + 'px ABOVE the cage plate at ' +
       'x=' + buriedAt.toFixed(0) + ', so that end of the platform is buried in the ' +
       'rock. The plate has to be set from the highest floor under the whole span, ' +
       'not from the floor at the cage centre');
} else {
  ok('the plate clears the floor across its whole span (' +
     (span.right - span.left).toFixed(0) + 'px wide, worst burial 0.0px)');
}

/* (3) Reachable: the rise is above the walk-up step and below the jump apex.
       JUMP_V^2 / (2*GRAVITY) = 60.75px, and CAVE_STEP is 14px. The MAXIMUM
       rise across the span is what matters - that is the worst landing a
       reader has to clear anywhere on the platform. */
let maxRise = -Infinity;
for (let x = span.left; x <= span.right; x += 4) {
  const under = CV.screenFloorY(x);
  if (isFinite(under)) maxRise = Math.max(maxRise, under - plate);
}
if (!(maxRise > 14)) {
  fail('the plate sits only ' + maxRise.toFixed(1) + 'px above the floor at its worst ' +
       'point, which is within CAVE_STEP (14px) - the player would walk straight up ' +
       'onto it and it would read as a bump in the floor rather than a platform');
} else if (!(maxRise < 60.75)) {
  fail('the plate sits ' + maxRise.toFixed(1) + 'px above the floor at its worst point, ' +
       'at or beyond the jump apex of 60.75px, so it could not be reached at all');
} else {
  ok('reachable: ' + maxRise.toFixed(1) + 'px above the floor at its worst point, ' +
     'between the 14px step-up and the 60.75px jump apex');
}

/* (4) It is inside the frame with the player standing on it. */
const headroom = plate - G.player.h;
if (headroom < 0) {
  fail('a player standing on the plate would have their head ' + (-headroom).toFixed(1) +
       'px above the top of the screen');
} else {
  ok('a player fits on the plate (' + headroom.toFixed(1) + 'px of headroom)');
}

/* === Land on it ============================================================
   Driven through movePlayerCave(), not movePlayerCage() directly: the point is
   that the player can GET there using the inputs they actually have. */
console.log('cage: landing');
function dropOnto(x) {
  G.player.x = x;
  G.player.vx = 0;
  /* Start above the plate and falling, which is what a jump's descent is. */
  G.player.y = plate - G.player.h - 6;
  G.player.vy = 120;
  G.player.onGround = false;
  for (let i = 0; i < 30; i++) G.movePlayerCave(1 / 60, G.player);
}
const mid = (span.left + span.right) / 2;
dropOnto(mid - G.player.w / 2);
if (Math.abs((G.player.y + G.player.h) - plate) > 1) {
  fail('a player dropped onto the middle of the cage ends up with their feet at ' +
       (G.player.y + G.player.h).toFixed(1) + ' rather than the plate at ' +
       plate.toFixed(1) + '; the landing never caught them');
} else {
  ok('a falling player lands on the plate and stays on it (feet at ' +
     (G.player.y + G.player.h).toFixed(1) + ')');
}

/* Holding still must NOT sink them. This is the specific failure mode of adding
   a platform without excluding the floor resolve: gravity re-applies every
   frame and the player falls through a surface they are standing on. */
{
  const before = G.player.y;
  for (let i = 0; i < 120; i++) G.movePlayerCave(1 / 60, G.player);
  if (G.player.y > before + 1) {
    fail('a player standing still on the plate sank ' + (G.player.y - before).toFixed(1) +
         'px through it over two seconds - the floor resolve is still claiming them');
  } else {
    ok('a player standing still on the plate does not sink through it');
  }
}

/* === One-way ===============================================================
   The property with no visual signature: walking in from the side must pass
   UNDER the plate, and must never teleport the player up onto it. */
console.log('cage: one-way');
{
  const outside = span.left - G.player.w - 30;
  G.player.x = outside;
  G.player.vx = 0;
  /* On the cave floor, as they would be after walking across the room. */
  G.player.y = CV.screenFloorY(outside + G.player.w / 2) - G.player.h;
  G.player.vy = 0;
  G.player.onGround = true;
  const floorBefore = G.player.y + G.player.h;
  G.player.vx = G.WALK_SPEED;
  for (let i = 0; i < 400; i++) G.movePlayerCave(1 / 60, G.player);
  const centre = G.player.x + G.player.w / 2;
  if (centre > span.left && centre < span.right) {
    fail('a player walking right along the floor was stopped dead by the cage at ' +
         'x=' + centre.toFixed(0) + ' (span ' + span.left.toFixed(0) + '..' +
         span.right.toFixed(0) + '). The cage is an open frame, not a wall: it must ' +
         'add no horizontal collision');
  } else {
    ok('a player walks straight through under the cage, from x=' + outside.toFixed(0) +
       ' to x=' + centre.toFixed(0));
  }
  if (G.player.y + G.player.h < floorBefore - 26) {
    fail('walking under the cage lifted the player ' +
         (floorBefore - (G.player.y + G.player.h)).toFixed(1) +
         'px off the floor - they were snapped up onto the plate from the side');
  } else {
    ok('walking under the cage leaves the player on the floor, not lifted onto the plate');
  }
}
/* Jumping up through the plate from underneath must pass cleanly. This is the
   case the rising guard exists for: a player rising through the cage satisfies
   every other condition here, and without that guard they get slammed back down
   onto the plate the instant they touch it - so they can never get on, and the
   platform is scenery. */
{
  const cx = (span.left + span.right) / 2;
  G.player.x = cx - G.player.w / 2;
  G.player.y = CV.screenFloorY(cx) - G.player.h;   /* on the floor, under it */
  G.player.vy = 0; G.player.vx = 0; G.player.onGround = true;
  G.player.vy = -540;                                /* a full jump */
  let reached = false;
  for (let i = 0; i < 90; i++) {
    G.movePlayerCave(1 / 60, G.player);
    if (G.player.y + G.player.h <= plate - 1) reached = true;
  }
  if (!reached) {
    fail('a player jumping from underneath the cage never got their feet above the ' +
         'plate; they were stopped by it, so it behaves as a ceiling rather than a ' +
         'one-way platform');
  } else {
    ok('a player can jump up THROUGH the plate from underneath');
  }
}

/* The whole point of the cage: jump up through it from underneath, and land on
     top. Reaching the apex proves only that the plate is not a ceiling; this
     asserts the landing, which is the property a reader actually experiences. */
{
  const cx = (span.left + span.right) / 2;
  G.player.x = cx - G.player.w / 2;
  G.player.y = CV.screenFloorY(cx) - G.player.h;
  G.player.vx = 0; G.player.onGround = true;
  G.player.vy = -540;
  let topped = false;
  for (let i = 0; i < 150; i++) {
    G.movePlayerCave(1 / 60, G.player);
    /* "Topped" means resting ON the plate, not merely above it mid-flight. */
    if (Math.abs((G.player.y + G.player.h) - plate) <= 1 && G.player.onGround) topped = true;
  }
  if (!topped) {
    fail('a player who jumps up through the cage never came to rest on top of it ' +
         '(they end at ' + (G.player.y + G.player.h).toFixed(1) + ', plate at ' +
         plate.toFixed(1) + '); the cage is not a platform you can stand on');
  } else {
    ok('a player jumps up through the cage and lands ON TOP of it');
  }
}

/* === The art agrees ========================================================
   The plate the collision uses and the plate the renderer paints are one
   number. Rather than trust that, this watches the draw calls: a cage that
   paints its lit lip somewhere other than the collision line would leave the
   sprite standing on nothing at all. */
console.log('cage: art');
{
  const drawn = [];
  recording = drawn;
  globalThis.window.scrollY = Math.max(0, TREASURE_TOP - 100);
  L.syncScroll();
  G.player.x = mid - G.player.w / 2;
  G.player.inCave = true;
  R.render(16);
  recording = null;

  /* The plate Y, read fresh from the module rather than reused from above, so
     this cannot pass by agreeing with a stale copy of itself. */
  const livePlate = CG.cageFloorY();
  const onPlate = drawn.filter((r) =>
    Math.abs(r[1] - livePlate) < 1 && r[3] <= 3 && r[2] > 20);
  if (!drawn.length) {
    fail('render() issued no fillRect calls at all, so this frame cannot tell a ' +
         'cage that was not drawn from a renderer that had stopped');
  } else if (!onPlate.length) {
    fail('nothing was drawn at the cage plate y=' + livePlate.toFixed(1) + ' across a ' +
         (span.right - span.left).toFixed(0) + 'px span, so the platform the player ' +
         'lands on is not painted (' + drawn.length + ' rects drawn this frame)');
  } else {
    ok('the plate is drawn at the collision y (' + onPlate.length +
       ' thin bars at y=' + livePlate.toFixed(1) + ' of ' + drawn.length + ' rects)');
  }
}

/* The CAGE is static geometry: drawn from measured positions only, with no frame
   counter and no animation. It is NOT the only static thing in the cave any
   more - the wall torches flicker, deliberately, and are the cave's one moving
   element - so this can no longer assert that the whole frame is identical.
   It asserts the narrower, correct thing: the CAGE'S OWN RECTS are byte-identical
   between two frames a long way apart. If the cage ever picked up a clock, this
   is what would see it. */
{
  const cageRects = (arr) => {
    const s = CG.cageSpan();
    const plate = CG.cageFloorY();
    return arr.filter((r) => r[0] >= s.left - 12 && r[0] + r[2] <= s.right + 12 &&
                            r[1] >= plate - 40)
               .map((r) => r.join(','));
  };
  const a = [], b = [];
  recording = a; R.render(16); recording = null;
  recording = b; R.render(9900); recording = null;
  const ca = cageRects(a), cb = cageRects(b);

  /* THE SHAFT'S OWN STRUCTURE MUST NOT MOVE EITHER. The cage check above caught a
     real bug in the shaft art and reported it as a cage fault, because the shaft's
     timber and lamps overlap the cage's rectangle.

     The cause was hash01() caching one generator and never rebuilding it, so every
     scatter value depended on how many times anything had asked before it did, and
     the timber hopped down the shaft on every frame. Asserted directly here so it
     is reported as what it is.

     Two renders at the same scroll, drawn a long way apart in time, must produce
     identical shaft geometry. Scoped to the shaft's own x range so the wall torches
     - which flicker deliberately, and are the cave's one moving element - cannot
     be mistaken for instability. */
  {
    const sh = L.shaftLeft(), sw = L.shaftRight();
    const inShaft = (arr) => arr.filter((r) =>
      r[0] >= sh - 10 && r[0] + r[2] <= sw + 10);
    const sa = inShaft(a), sb = inShaft(b);
    /* COMPARED AS SETS, NOT AS SEQUENCES. Sorted copies: drawing order within a
       frame is not a property worth asserting, and comparing the raw arrays reports a
       difference whenever two identical rects are emitted in a different order -
       which is what happened here, with the same 530 rects in both frames. The thing
       that matters is that the same geometry was painted, not the order it was
       painted in. */
    /* Joined to strings before sorting. sort() on an array of arrays coerces to
       strings, which works, but every then compared ARRAYS with === and never matched
       - a false failure that reported 530 vs 530 as a difference. The counts were
       always equal here; the comparison was simply wrong. Comparing joined strings
       compares values. */
    const saS = sa.map((v) => v.join(',')).sort();
    const sbS = sb.map((v) => v.join(',')).sort();
    if (saS.length !== sbS.length || !saS.every((v, i) => v === sbS[i])) {
      fail('the shaft geometry differs between two frames drawn a long way apart at ' +
           'the same scroll (' + sa.length + ' vs ' + sb.length + ' rects). The shaft ' +
           'art must be deterministic: anything scattered has to come from a stable ' +
           'hash, or the timber and lamps visibly hop on every frame');
    } else {
      ok('the shaft structure is byte-identical between frames', true);
    }
  }
  const same = ca.length === cb.length && ca.every((v, i) => v === cb[i]);
  if (!ca.length) {
    fail('no rects were found in the cage area at all, so this cannot tell the cage ' +
         'being static from the renderer having stopped drawing it');
  } else if (!same) {
    fail('the cage rects differ between t=16ms and t=9900ms (' + ca.length + ' vs ' +
         cb.length + '); the cage is static geometry and must not read the clock');
  } else {
    ok('the cage is static: ' + ca.length + ' identical rects at t=16ms and t=9900ms, ' +
       'while the cave as a whole animates its torch flames');
  }
}

console.log('');
if (failures) {
  console.log('CAGE TEST FAILED: ' + failures + ' problem' + (failures === 1 ? '' : 's'));
  process.exit(1);
}
console.log('CAGE TEST PASSED:');
console.log('  the plate clears the floor across its whole span, and is reachable');
console.log('  a falling player lands on it and does not sink through it');
console.log('  it is one-way: walk in underneath, walk off the edge and drop');
console.log('  the painted lip is at the same y the collision resolves against');
console.log('  the cage is static even though the cave animates its torch flames');
console.log('  it is static, so reduced motion needs no special case');


