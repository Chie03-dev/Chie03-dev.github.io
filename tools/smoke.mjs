/* ==========================================================================
   tools/smoke.mjs - the verification that actually works for this project
   ==========================================================================
   Run it with:  node tools/smoke.mjs      (from the repo root)

   WHY THIS EXISTS, because the obvious thing does not work:

   `node --check js/render.js` reports exit 0 for a broken ES module in this
   repo. A file containing `export const a = 1;` followed by `const b = ;` is a
   hard syntax error, and --check still exits 0 on a .js file (it exits 1 on the
   same content named .mjs). Every "all modules parse" claim made with that
   command was a false pass, and one of them shipped a file that could not load
   in a browser at all. Do not use it here.

   This imports every module for real, against a stubbed DOM, and then draws.
   That catches three separate classes of failure:

     1. Syntax errors, because the module is genuinely parsed as an ES module.
     2. Reference errors at draw time, with a real stack trace.
     3. Non-finite drawing coordinates. This is the one that matters most for a
        canvas: the 2d context is designed NOT to complain, so a
        `fillRect(NaN, ...)` is silently dropped and the art just vanishes with
        no error anywhere. The stub context below reports every non-finite
        argument, which turns "some art is missing and I have no idea why" into
        a failing test.

   It also asserts the elevator's specification, so a change that breaks the
   feel of it fails here rather than in front of a visitor:

     - the car's band is centred and inside the viewport at every size
     - the car holds still through the sky, travels only across the middle
       layers, and holds still again from the bedrock down
     - the car never reverses direction
     - the character never sinks through the car floor and never leaves the
       screen

   No dependencies, no build step, and nothing here is ever fetched by a
   browser - this file is not part of the site.
   ========================================================================== */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* import() on Windows needs a file:// URL, not a bare drive path, or the ESM
   loader rejects the "d:" as an unknown scheme. */
const load = (rel) => import(pathToFileURL(join(ROOT, rel)).href);

/* === The stubbed DOM and 2d context ======================================== */

const noop = () => {};
const nonFinite = [];

function finite(v, where) {
  if (typeof v !== 'number' || !isFinite(v)) nonFinite.push(where + '=' + String(v));
  return v;
}

function makeCtx() {
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1,
    imageSmoothingEnabled: false,
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop,
    lineTo: noop, rect: noop, clip: noop, fill: noop, stroke: noop,
    clearRect: noop, strokeRect: noop, drawImage: noop, rotate: noop, scale: noop,
    setTransform: noop, ellipse: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    createPattern: () => ({}),
    measureText: () => ({ width: 0 }),
    translate: (a, b) => { finite(a, 'translate.x'); finite(b, 'translate.y'); },
    arc: (a, b, r) => { finite(a, 'arc.x'); finite(b, 'arc.y'); finite(r, 'arc.r'); },
    fillRect: (x, y, w, h) => {
      finite(x, 'fillRect.x'); finite(y, 'fillRect.y');
      finite(w, 'fillRect.w'); finite(h, 'fillRect.h');
    },
    createLinearGradient: (x, y) => {
      finite(x, 'linear.x'); finite(y, 'linear.y');
      return { addColorStop: noop };
    },
    createRadialGradient: (x, y, r) => {
      finite(x, 'radial.x'); finite(y, 'radial.y'); finite(r, 'radial.r');
      return { addColorStop: noop };
    }
  };
}

/* A stand-in for a measured element. The positions passed in are DOCUMENT
   coordinates, but getBoundingClientRect() returns VIEWPORT coordinates, so the
   current scroll has to be subtracted on every call.

   This detail is not pedantry. layers.js measure() does
   `rect.top + window.scrollY` precisely because the browser hands back a
   viewport-relative box, and a stub that returns a fixed document position
   silently breaks that contract: it happens to be correct while scrollY is 0
   and wrong for every scroll offset after that. The first version of this file
   did exactly that, and it reported eleven confident failures - the car "not
   held at the bottom" - which were entirely an artefact of the stub. The app was
   correct the whole time. */
const box = (docTop, height, left, width) => ({
  getBoundingClientRect: () => {
    const y = docTop - (globalThis.window.scrollY || 0);
    return { top: y, left, width, height, bottom: y + height, right: left + width };
  }
});

const stage = { width: 0, height: 0, style: {}, getContext: makeCtx };
const known = {
  summary: box(0, 1400, 100, 900), skills: box(1400, 1400, 100, 900),
  projects: box(2800, 1400, 100, 900), experience: box(4200, 1400, 100, 900),
  education: box(5600, 1400, 100, 900), '.dig__shaft': box(0, 7000, 620, 200)
};
const stubEl = (sel) => known[sel] || {
  classList: { add: noop, remove: noop, contains: () => false },
  style: {}, dataset: {}, textContent: '', addEventListener: noop,
  querySelector: () => null, getBoundingClientRect: () => box(0, 0, 0, 0)
};

globalThis.document = {
  getElementById: (id) => (id === 'stage' ? stage : stubEl(id)),
  querySelector: stubEl,
  querySelectorAll: () => [],
  createElement: () => ({ width: 0, height: 0, style: {}, getContext: makeCtx }),
  addEventListener: noop,
  documentElement: { clientWidth: 1440, clientHeight: 900, scrollHeight: 7900, style: {} },
  fonts: { ready: Promise.resolve() },
  hidden: false
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

const VIEWPORTS = [
  [1920, 1200], [1600, 1200], [1440, 900], [1366, 768], [1280, 720],
  [1024, 300], [900, 1600], [820, 1180], [414, 896], [360, 640],
  [320, 480], [300, 200]
];

let failures = 0;
const fail = (msg) => { failures++; console.log('    FAIL ' + msg); };
const near = (a, b) => Math.abs(a - b) < 1;

/* Every import must resolve to a real export and be used, and the graph must be
   acyclic - the rules ask for layers <- game <- render with ui and main on top,
   so a cycle is a rule violation as well as a runtime hazard. */
function checkGraph(files) {
  /* Two passes on purpose: the export lists have to be collected for EVERY file
     before any import is checked, or a file that is imported before it has been
     walked looks like it exports nothing. (It did, and it reported sixteen
     confident false failures the first time this ran.) */
  const exports = {};
  const deps = {};
  const sources = {};
  for (const f of files) {
    const t = readFileSync(join(ROOT, 'js', f), 'utf8');
    sources[f] = t;
    const m = t.match(/export\s*\{([\s\S]*?)\}/);
    exports[f] = m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : [];
    deps[f] = [...t.matchAll(/from\s*'\.\/([A-Za-z]+)\.js'/g)].map(x => x[1] + '.js');
  }
  for (const f of files) {
    const t = sources[f];
    const re = /import\s*\{([\s\S]*?)\}\s*from\s*'\.\/([A-Za-z]+)\.js'/g;
    let im;
    while ((im = re.exec(t))) {
      const body = t.slice(t.indexOf('\n', t.lastIndexOf('import')));
      for (const n of im[1].split(',').map(s => s.trim()).filter(Boolean)) {
        const target = im[2] + '.js';
        if (!exports[target]) fail(f + ' imports a module that does not exist: ' + target);
        else if (!exports[target].includes(n)) fail(target + ' does not export ' + n + ' (needed by ' + f + ')');
        else if (!new RegExp('\\b' + n + '\\b').test(body)) fail(f + ' imports ' + n + ' but never uses it');
      }
    }
  }
  const state = {};
  const walk = (n, stack) => {
    if (state[n] === 'done') return;
    if (state[n] === 'open') { fail('import cycle: ' + [...stack, n].join(' -> ')); return; }
    state[n] = 'open';
    for (const d of deps[n] || []) walk(d, [...stack, n]);
    state[n] = 'done';
  };
  for (const f of files) walk(f, []);
  return deps;
}

async function run() {
  /* 1. Every module must genuinely load as an ES module. This is the check
        node --check cannot do, and the one that would have caught a blank
        canvas. */
  const L = await load('js/layers.js');
  const D = await load('js/deck.js');
  const G = await load('js/game.js');
  const R = await load('js/render.js');
  await load('js/ui.js');
  const files = readdirSync(join(ROOT, 'js')).filter(f => f.endsWith('.js'));
  console.log('modules   all ' + files.length + ' load as ES modules');

  /* 2. The import graph. */
  const deps = checkGraph(files);
  console.log('graph     ' + files.map(f => f.replace('.js', '') + '->[' +
              (deps[f] || []).map(d => d.replace('.js', '')).join(',') + ']').join('  '));

  /* 3. Per viewport: geometry, the two holds, and a full walk of the page. */
  for (const [w, h] of VIEWPORTS) {
    const label = String(w).padStart(4) + 'x' + String(h).padStart(4);
    const before = failures;

    globalThis.document.documentElement.clientWidth = w;
    globalThis.document.documentElement.clientHeight = h;
    globalThis.window.innerHeight = h;
    L.resizeViewport(); L.measure(); L.measureShaft(); G.snapPlayerToGround();

    const band = D.deckBounds();
    const sheave = D.sheaveY();
    const headAtTop = band.top - L.SPRITE_H;

    if (!(band.bot > band.top)) fail(label + ' band is inverted or empty');
    if (band.top < 0 || band.bot > h) {
      fail(label + ' band leaves the viewport: ' + band.top.toFixed(0) + '..' + band.bot.toFixed(0));
    }
    if (sheave - 9 < 0) fail(label + ' sheave is cropped off the top of the screen');
    if (sheave + 9 > headAtTop && h > 260) {
      fail(label + ' sheave overlaps the character (wheel bottom ' + (sheave + 9).toFixed(0) +
           ', head at ' + headAtTop.toFixed(0) + ')');
    }

    /* The travel window: hold at the top through the sky, move only across the
       middle layers, hold at the bottom from the bedrock down. */
    const skyEnd = L.layers[1] ? L.layers[1].top : 0;
    const cavesEnd = L.layers[3] ? L.layers[3].bottom : 0;
    const settle = (sc) => {
      globalThis.window.scrollY = sc;
      L.syncScroll();
      for (let i = 0; i < 250; i++) D.advanceCar(1 / 60);
      G.movePlayer(1 / 60);
      return D.groundY();
    };

    if (!near(settle(0), band.top)) fail(label + ' car is not held at the top through the sky');
    if (!near(settle(Math.max(0, skyEnd - 1)), band.top)) {
      fail(label + ' car starts moving before the sky has ended');
    }
    if (!near(settle(cavesEnd), band.bot)) fail(label + ' car is not at the bottom by the end of the caves');
    const atEnd = settle(L.maxScroll);
    if (!near(atEnd, band.bot)) {
      fail(label + ' car is not held at the bottom through the treasure room' +
           ' (scroll ' + L.maxScroll + ' -> y ' + atEnd.toFixed(1) + ', expected ' + band.bot.toFixed(1) + ')');
    }
    const midY = settle((skyEnd + cavesEnd) / 2);
    if (!(midY > band.top + 1 && midY < band.bot - 1)) {
      fail(label + ' car does not actually travel across the middle layers');
    }


    /* Walk the whole page: monotonic, in band, and the character never sinks.
       This is the check that would have caught the original "the elevator goes
       up while I scroll down" bug, which measured 140 direction reversals. */
    let prev = -Infinity, reversals = 0, sunk = 0, offscreen = 0, outOfBand = 0;
    for (let sc = 0; sc <= L.maxScroll; sc += 50) {
      const y = settle(sc);
      if (y < prev - 0.01) reversals++;
      if (y < band.top - 0.01 || y > band.bot + 0.01) outOfBand++;
      if (G.player.y + G.player.h > y + 0.01) sunk++;
      if (y > h + 0.01 || G.player.y < -0.01) offscreen++;
      prev = y;
    }
    if (reversals) fail(label + ' ' + reversals + ' direction reversals');
    if (outOfBand) fail(label + ' ' + outOfBand + ' frames outside the band');
    if (sunk) fail(label + ' character sank through the car floor on ' + sunk + ' frames');
    if (offscreen) fail(label + ' character or car left the screen on ' + offscreen + ' frames');

    /* And a real draw at the top, the middle and the bottom. Non-finite
       coordinates are the silent failure mode: the canvas drops them without a
       word, so the art would simply be missing. */
    for (const sc of [0, Math.round(L.maxScroll / 2), L.maxScroll]) {
      settle(sc);
      nonFinite.length = 0;
      try {
        R.render(16);
      } catch (e) {
        fail(label + ' render() threw at scroll ' + sc + ': ' + e.message);
        continue;
      }
      if (nonFinite.length) {
        fail(label + ' non-finite drawing coordinates at scroll ' + sc + ': ' +
             [...new Set(nonFinite)].slice(0, 4).join(', '));
      }
    }

    const pct = (100 * band.top / h).toFixed(0) + '%..' + (100 * band.bot / h).toFixed(0) + '%';
    console.log('  ' + label + '  band ' + band.top.toFixed(0).padStart(4) + '..' +
                band.bot.toFixed(0).padStart(4) + ' (' + pct.padStart(9) + ')  sheave ' +
                String(sheave).padStart(3) + '  ' + (failures === before ? 'ok' : 'PROBLEMS'));
  }

  console.log('');
  if (failures) {
    console.log('SMOKE FAILED: ' + failures + ' problem(s)');
    process.exitCode = 1;
    return;
  }
  console.log('SMOKE PASSED:');
  console.log('  modules load; graph acyclic; every import resolves and is used');
  console.log('  band centred and inside the viewport at all ' + VIEWPORTS.length + ' sizes');
  console.log('  car holds at the top through the sky, travels the middle layers only,');
  console.log('  and holds at the bottom through the treasure room');
  console.log('  no direction reversals; character never sinks; no non-finite coordinates');
}

run().catch((e) => {
  console.error('SMOKE ERRORED: ' + e.message);
  console.error(e.stack);
  process.exitCode = 1;
});


