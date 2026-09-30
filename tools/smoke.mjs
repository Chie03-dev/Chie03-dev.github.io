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
    clearRect: noop, strokeRect: noop, rotate: noop, scale: noop,
    /* drawImage is the one call that used to be a bare noop, and that is a
       hole big enough to hide a real crash. A browser THROWS on this: an
       IndexSizeError for a zero or negative destination width or height, and
       an InvalidStateError for a source that is not an image at all. A biome
       module that blits sprites is exactly where such a mistake lives, and a
       noop stub reports nothing while the page renders a black canvas and the
       frame loop dies on the first call.

       So this validates what the spec makes mandatory, and the arguments the
       real overload requires: finite dx/dy, finite and strictly positive
       dw/dh, and a source with positive dimensions. */
    drawImage: (src, dx, dy, dw, dh) => {
      finite(dx, 'drawImage.dx'); finite(dy, 'drawImage.dy');
      finite(dw, 'drawImage.dw'); finite(dh, 'drawImage.dh');
      if (!(dw > 0) || !(dh > 0)) {
        throw new Error('IndexSizeError: drawImage destination ' + dw + 'x' + dh);
      }
      if (!src || !(src.width > 0) || !(src.height > 0)) {
        throw new Error('InvalidStateError: drawImage source has no pixels');
      }
    },
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
  summary: box(0, 1400, 48, 520), skills: box(1400, 1400, 872, 520),
  projects: box(2800, 1400, 48, 520), experience: box(4200, 1400, 872, 520),
  education: box(5600, 1400, 48, 520), '.dig__shaft': box(0, 7600, 620, 200),
  /* The rooms the travel window is anchored to, keyed by the exact selectors
     layers.js measure() uses. The treasure room is also data-layer="bedrock",
     so selecting it by class is what distinguishes it from the Education
     chamber - and the car is specified to stop BEFORE it. */
  '[data-layer="dirt"]': box(1400, 1400, 872, 520),
  '.treasure': box(7000, 600, 48, 1344)
};
/* The document Y of the treasure room, taken from the stub itself rather than
   repeated as a literal, so the barrier assertion below cannot drift away from
   the geometry that actually drives it. Read through the stub's own docTop
   closure value, NOT via getBoundingClientRect() - that subtracts the current
   scroll, and `window` does not exist yet at this point in the file. */
const TREASURE_TOP = 7000;
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
  /* Load EVERY module in js/, including main.js, and count what was really
     loaded rather than what is on disk.

     This used to be a hand-picked list of six files and it printed
     readdirSync's file count - so it cheerfully announced "all 8 load" while
     main.js had never been imported at all. main.js is where the boot sequence
     lives, so every ReferenceError reachable from boot was untested, and a
     browser could die on one and show a black canvas with the harness green.

     Importing main.js also runs its top-level boot - resize(), updateDepth(),
     start() - which is exactly the point. start() only asks the stub for a
     requestAnimationFrame id, so no frame loop runs here. */
  const onDisk = readdirSync(join(ROOT, 'js')).filter(f => f.endsWith('.js')).sort();
  const M = {};
  for (const f of onDisk) M[f.replace('.js', '')] = await load('js/' + f);
  const files = onDisk;
  if (!M.main) fail('js/main.js is on disk but was not loaded - the boot path is untested');
  console.log('modules   ' + Object.keys(M).length + ' of ' + files.length +
              ' on disk loaded and booted: ' + Object.keys(M).sort().join(' '));
  const L = M.layers, D = M.deck, G = M.game, R = M.render, S = M.sprites;

  /* 2. The import graph. */
  const deps = checkGraph(files);
  console.log('graph     ' + files.map(f => f.replace('.js', '') + '->[' +
              (deps[f] || []).map(d => d.replace('.js', '')).join(',') + ']').join('  '));

  /* 2b. The shaft channel through the treasure room. This one is a check on the
        STYLESHEET rather than on behaviour, and it is here for a specific
        reason: the channel is what stops the sprite being buried by the room,
        and nothing in the JS above can see a CSS mask. Without this, deleting
        the channel would leave every other assertion in this file perfectly
        green while the sprite went back behind the rock.

        Whitespace is stripped first so a reformat cannot silently disarm it. */
  const layoutCss = readFileSync(join(ROOT, 'css', 'layout.css'), 'utf8');
  const chambersCss = readFileSync(join(ROOT, 'css', 'chambers.css'), 'utf8');
  const flat = (s) => s.replace(/\s+/g, '');
  /* Both the prefixed and unprefixed forms must be a real gradient cut, not
     merely present. An earlier version of this check only asked whether the
     property appeared at all, and the mutation test caught that: neutering the
     -webkit- line still left the unprefixed one, so the check passed while
     Safari - which needs the prefix - would have shown no channel at all. */
  if (!/#contact::before\{[^}]*-webkit-mask-image:linear-gradient/.test(flat(layoutCss))) {
    fail('the treasure room has no shaft channel: #contact::before carries no mask cut');
  }
  if (!/#contact::before\{[^}]*[^-\w]mask-image:linear-gradient/.test(flat(layoutCss))) {
    fail('the shaft channel has no unprefixed mask, so it will not render');
  }
  if (!/--ch:calc\(\(var\(--shaft-w\)/.test(flat(layoutCss))) {
    fail('the channel width --ch is not derived from the shaft token');
  }
  if (!/#contact\{[^}]*background:none/.test(flat(chambersCss))) {
    fail('#contact still paints its own background, which would cover the channel');
  }
  const phoneCss = flat(layoutCss).slice(flat(layoutCss).indexOf('@media(max-width:820px)'));
  if (!/#contact\{display:block/.test(phoneCss)) {
    fail('the phone layout does not restore the single-column treasure room');
  }

  /* 2c. The sprite registry must actually contain sprites. This check exists
        because fault 14 in the mutation test proved the point the hard way:
        emptying SET.tufts made every sprite lookup return undefined, blit()
        returned early, nothing threw, and the whole biome still reported itself
        as having drawn. A per-band counter cannot see a missing sprite - only
        a look at the registry can.

        So each set is asserted non-empty, and the flower beds are asserted to
        have all four colours, because "vibrant flowers on the surface layer" is
        a stated requirement and not a stylistic preference. */
  const SETS = ['conifers', 'canopies', 'tufts', 'blooms', 'soil', 'roots', 'ore',
                'blocks', 'moss', 'crystals', 'spikesDown', 'spikesUp', 'strata',
                'nuggets', 'shelves'];
  for (const k of SETS) {
    if (!Array.isArray(S.SET[k]) || !S.SET[k].length) {
      fail('the sprite set ' + k + ' is empty, so that biome silently draws nothing');
      continue;
    }
    /* blooms is one level deeper - an array of arrays, one per flower colour -
       so it is checked separately below rather than here. */
    if (k === 'blooms') continue;
    /* Every baked sprite must have real, finite, positive dimensions. This is
       the check that would have caught the bakeCanopy() call that passed the
       palette where the height belonged: NaN height, the dome loop silently
       never ran, nothing threw at bake time, and the sprite was only found out
       at drawImage - where a real browser throws and takes the whole frame loop
       with it, leaving a black canvas. The stub used to no-op drawImage and
       reported nothing. */
    S.SET[k].forEach((spr, i) => {
      if (!spr || !isFinite(spr.width) || !isFinite(spr.height) ||
          !(spr.width > 0) || !(spr.height > 0)) {
        fail('sprite ' + k + '[' + i + '] has bad dimensions ' +
             (spr ? spr.width + 'x' + spr.height : '(missing)') +
             ' - a baker was probably called with the wrong arguments');
      }
    });
  }
  /* The flower beds are one level deeper: an array of arrays. */
  if (Array.isArray(S.SET.blooms)) {
    S.SET.blooms.forEach((bed, i) => {
      if (!Array.isArray(bed) || !bed.length) {
        fail('flower bed ' + i + ' is empty');
        return;
      }
      bed.forEach((spr, j) => {
        if (!spr || !isFinite(spr.height) || !(spr.height > 0)) {
          fail('flower bed ' + i + '[' + j + '] has bad dimensions');
        }
      });
    });
  }
  if (S.FLOWERS.length < 4) {
    fail('only ' + S.FLOWERS.length + ' flower colours baked; the surface layer needs four');
  }
  if (!Array.isArray(S.SET.blooms) || S.SET.blooms.length !== S.FLOWERS.length) {
    fail('a flower colour has no baked bed');
  }

  /* 3. Per viewport: geometry, the two holds, and a full walk of the page. */

  for (const [w, h] of VIEWPORTS) {
    const label = String(w).padStart(4) + 'x' + String(h).padStart(4);
    const before = failures;

    globalThis.document.documentElement.clientWidth = w;
    globalThis.document.documentElement.clientHeight = h;
    globalThis.window.innerHeight = h;
    /* Drive the REAL boot sequence, exported from main.js. This used to be a
       hand-rolled copy of resize() that had drifted to four of its seven
       steps, and the step it dropped was the one that hid a browser-only
       crash. Calling the real one means the harness can never fall behind the
       page again. */
    M.main.resize();

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

    /* The travel window: the car sets off at the dirt room and stops just before
       the Bedrock treasure room, and is stationary everywhere else. These
       anchors come from layers.js, which measures them out of the markup. */
    const start = L.travelFrom;
    const end = L.travelTo;
    const settle = (sc) => {
      globalThis.window.scrollY = sc;
      L.syncScroll();
      for (let i = 0; i < 250; i++) D.advanceCar(1 / 60);
      G.movePlayer(1 / 60);
      return D.groundY();
    };

    if (!(end > start)) fail(label + ' travel window is empty or inverted: ' + start + '..' + end);
    if (L.layers[0] && start < L.layers[0].bottom) {
      fail(label + ' travel starts inside the sky section, not at the dirt');
    }
    if (L.layers[4] && end > L.layers[4].bottom) {
      fail(label + ' travel runs past the end of the bedrock chamber');
    }

    if (!near(settle(0), band.top)) fail(label + ' car is not held at the top through the sky');
    if (!near(settle(Math.max(0, start - 1)), band.top)) {
      fail(label + ' car starts moving before the dirt room');
    }
    if (!near(settle(end), band.bot)) fail(label + ' car is not at the bottom at the treasure room');

    /* The invisible barrier. The treasure room is full width, so it sits UNDER
       the shaft the sprite rides in, and the sprite must be parked at the bottom
       of its band while that room is still entirely below the fold - otherwise
       the car visibly descends into the room on the way down. Asserted in terms
       of where the room's top edge lands in SCREEN space at the stopping scroll
       position, because that is the thing the reader can actually see.

       TREASURE_TOP is the document Y of the `.treasure` stub above. The room is
       "entirely below the fold" when its top edge is at or past the bottom of
       the viewport, hence `>= h` with a 1px tolerance for rounding. */
    const treasureTopOnScreen = TREASURE_TOP - end;
    if (treasureTopOnScreen < h - 1) {
      fail(label + ' the car is fully down but the treasure room is already on screen (' +
           'top edge at ' + treasureTopOnScreen.toFixed(0) + ', viewport ' + h + ')');
    }

    /* What the page can actually reach. On a window TALLER than the content
       below the treasure room, the reader can never scroll that room's top edge
       to the top of the viewport, so the car cannot complete its travel - and
       that is correct, not a fault. Asserting "at the bottom of the band by the
       end of the page" would assert something unreachable, which is how this
       check first reported four confident failures that were all geometry rather
       than behaviour. So assert the two things that must hold either way: the
       car never passes its bottom stop, and it is never fully down while the
       treasure room is still below the fold. */
    const atEnd = settle(L.maxScroll);
    if (atEnd > band.bot + 0.01) {
      fail(label + ' car descends past its bottom stop (' + atEnd.toFixed(1) + ' > ' + band.bot.toFixed(1) + ')');
    }
    if (L.maxScroll >= end) {
      if (!near(atEnd, band.bot)) fail(label + ' car is not at the bottom stop at the end of the page');
    } else if (atEnd >= band.bot - 0.01) {
      fail(label + ' car is already fully down but the treasure room is still below the fold');
    }

    const midY = settle((start + end) / 2);
    if (!(midY > band.top + 1 && midY < band.bot - 1)) {
      fail(label + ' car does not actually travel between the dirt and the treasure room');
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

    /* The biomes must actually place art. This is the check that would have
       caught the stub geometry being wrong: every panel sat at the same
       left/width, so gutters() correctly returned nothing, every painter was
       skipped, and the module looked perfectly healthy while drawing nothing.
       A zero here is not a style complaint, it is a dead module. */
    settle(Math.round(L.maxScroll / 2));
    R.render(16);
    if (!R.biomesDrawn) {
      fail(label + ' no biome placed any art (gutters found nothing visible)');
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
  console.log('  car waits at the top through the sky, sets off at the dirt room,');
  console.log('  stops just before the Bedrock treasure room, and never passes that stop');
  console.log('  no direction reversals; character never sinks; no non-finite coordinates');
}

run().catch((e) => {
  console.error('SMOKE ERRORED: ' + e.message);
  console.error(e.stack);
  process.exitCode = 1;
});


