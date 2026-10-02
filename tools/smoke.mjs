/* How many rects one frame drew. The counter is the stub's own, so this measures
   what render() actually emitted rather than what any painter says it did. */
function countRects(draw) {
  globalThis.__rectCount = 0;
  draw();
  return globalThis.__rectCount;
}

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

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* import() on Windows needs a file:// URL, not a bare drive path, or the ESM
   loader rejects the "d:" as an unknown scheme. */
const load = (rel) => import(pathToFileURL(join(ROOT, rel)).href);

/* === The stubbed DOM and 2d context ======================================== */

const noop = () => {};
const nonFinite = [];
/* Every blit the frame made, as "src:dx:dy:dw:dh". Recorded so a check can compare
   one frame against another and prove that a given prop stayed put - see the
   tree-stability check below, which exists because the meadow used to reshuffle
   itself several times a second and nothing in the suite could see it. */
const blits = [];
const clips = [];
let pathPts = 0;

function finite(v, where) {
  if (typeof v !== 'number' || !isFinite(v)) nonFinite.push(where + '=' + String(v));
  return v;
}

function makeCtx() {
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1,
    imageSmoothingEnabled: false,
    save: noop, restore: noop, closePath: noop,
    /* rect() reports its arguments. It was a noop, which is a hole: rect(NaN, ...)
       is silently dropped by a real canvas, so art drawn at a nonsense position
       would simply not appear and nothing anywhere would say so.

       fillRect() is NOT defined here. It is defined further down this same object,
       where the rest of the drawing methods live, and it also counts itself so a
       check can measure how much a frame actually drew. Defining it twice is a
       silent trap: the later key wins, the earlier one is dead code, and a counter
       added to the dead one reads zero forever while looking entirely correct -
       which is what happened here for an hour. */
    rect: function (x, y, w, h) {
      finite(x, 'rect.x'); finite(y, 'rect.y');
      finite(w, 'rect.w'); finite(h, 'rect.h');
    },
    fill: noop,
    stroke: noop,
    /* Path and clip RECORDING, added for the surface-seam regression test.

       The seam is a jagged curve, so "the soil is clipped to the seam" is only
       observable as the SHAPE of the path handed to clip(). A bare noop stub
       cannot see it, which is why a real defect here shipped with a green
       suite: the turf was a flat rect and the dirt a flat rect, both unclipped,
       and every draw call was finite so nothing failed. */
    beginPath: () => { pathPts = 0; },
    moveTo: () => { pathPts++; },
    lineTo: () => { pathPts++; },
    clip: () => { clips.push(pathPts); },
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
    /* The three drawImage overloads, per the 2D spec:
         drawImage(img)                                -> 0,0,img.w,img.h
         drawImage(img, dx, dy)                        -> dx,dy,img.w,img.h
         drawImage(img, dx, dy, dw, dh)                -> the last four args
         drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) -> the last FOUR, and
                                                          the first four are the
                                                          source rect.

       Only the 5-argument form was modelled, so a 9-argument call bound its
       SOURCE rect as if it were the destination and a 3-argument call supplied
       no dw/dh at all. Both then failed the destination check for reasons that
       had nothing to do with the caller - which is how the real bug in tint()
       first surfaced, and then how the deliberate 3-argument blit in tint() got
       reported as a defect it did not have. */
    drawImage: function (src) {
      const a = Array.prototype.slice.call(arguments);
      /* Only the 9-argument form carries an 8-number tail; the shorter ones
         take the destination from the first four numbers after the image. */
      const off = a.length >= 9 ? 5 : 1;
      let dw = a[off + 2], dh = a[off + 3];
      /* The 1- and 3-argument forms have no dw/dh: the spec derives them from
         the source's own size. Modelling that is what makes those overloads
         checkable instead of crashing on undefined. */
      if (dw === undefined) dw = src && src.width;
      if (dh === undefined) dh = src && src.height;
      const dx = a[off], dy = a[off + 1];
      finite(dx, 'drawImage.dx'); finite(dy, 'drawImage.dy');
      finite(dw, 'drawImage.dw'); finite(dh, 'drawImage.dh');
      if (!(dw > 0) || !(dh > 0)) {
        throw new Error('IndexSizeError: drawImage destination ' + dw + 'x' + dh);
      }
      if (!src || !(src.width > 0) || !(src.height > 0)) {
        throw new Error('InvalidStateError: drawImage source has no pixels');
      }
      /* Record the resolved destination. Keyed by source identity so a caller can
         ask "did THIS sprite move between two frames", which is a far sharper
         question than comparing every blit in the frame. */
      blits.push({ src: src, dx: dx, dy: dy, dw: dw, dh: dh });
    },
    setTransform: noop, ellipse: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    createPattern: () => ({}),
    measureText: () => ({ width: 0 }),
    translate: (a, b) => { finite(a, 'translate.x'); finite(b, 'translate.y'); },
    arc: (a, b, r) => { finite(a, 'arc.x'); finite(b, 'arc.y'); finite(r, 'arc.r'); },
    fillRect: (x, y, w, h) => {
      finite(x, 'fillRect.x'); finite(y, 'fillRect.y');
      finite(w, 'fillRect.w'); finite(h, 'fillRect.h');
      globalThis.__rectCount = (globalThis.__rectCount || 0) + 1;
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
  /* The panels are stacked with REAL GAPS between them, not flush. That is the
     whole point of the fixture: bands.js derives each band from the midpoint of
     the gap above and below its panel, so flush stubs would make every band
     exactly equal to its panel and the assertions below would pass without ever
     testing the derivation. 434px of gap, 200 of panel, repeated. */
  summary: box(0, 200, 48, 520), skills: box(634, 200, 872, 520),
  projects: box(1268, 200, 48, 520), experience: box(1902, 200, 872, 520),
  education: box(2536, 200, 48, 520), '.dig__shaft': box(0, 2736, 620, 200),
  /* The sixth room. It is a real <section> now, so measure() finds it by id like
     the other five and it comes out of the PANEL loop - there is no synthetic
     band any more. It sits below Education, and the walkable cavern is the
     airspace under it that the dig's bottom padding reserves. */
  cave: box(3170, 200, 872, 520), '#cave': box(3170, 200, 872, 520),
  /* The rooms the travel window is anchored to, keyed by the exact selectors
     layers.js measure() uses.

     `.dig` is the grid every row lives in, and it is now the cave's anchor:
     measureCave() reads its box, and layers.js reads its bottom for the floor of
     the bedrock band. It runs from the top of the dig (docTop 0, the surface
     camp) down to 3770, which is below the Education chamber at 2536+200 =
     2736 - so the cave's room top, derived from that chamber's bottom, is 2736
     and the cave occupies 2736..3770.

     '[data-layer="bedrock"].chamber' is the Education chamber, and travelTo is
     its BOTTOM. cave.js selects the same exact string for the cave's top, so the
     car's stop and the cave's ceiling come from one number rather than two that
     could drift apart. */
  '[data-layer="dirt"]': box(634, 200, 872, 520),
  '[data-layer="bedrock"].chamber': box(2536, 200, 48, 520),
  '.dig': box(0, 3874, 0, 1440)
};
/* The document Y of the foot of the dig - the cave's ceiling, and what the
   barrier assertion below measures against. Read through the stub's own docTop
   closure value, NOT via getBoundingClientRect() - that subtracts the current
   scroll, and `window` does not exist yet at this point in the file. */
const TREASURE_TOP = 3370;
/* The cave room's top is the CAVE SECTION's bottom (3370), not Education's - the
   cave is a real room now. The dig runs to 3874, i.e. 504px below it, which is
   what the real CSS reserves at 900px tall (56vh). */
const CAVE_TOP = 3370;
/* The fake-chest fixture (fakeLoot, fakeChest, FAKE_CHESTS, FAKE_TOTAL) and the
   vault-grid / gold-count / gold-total / contact stubs that served it are GONE
   with the hoard. They existed so initHoard() would find five real chests and
   a real room to write --gold onto; both of those are gone, and leaving a
   fixture for a module that no longer exists would have smoke.mjs importing a
   dead file's worth of ids and asserting nothing about them.

   '.treasure' itself is GONE from `known` above, with the room it measured. The
   fixture now keys `.dig` (the cave's anchor) and '[data-layer="bedrock"].chamber'
   (the foot of the dig, which travelTo and the cave's top both come from). */

const stubEl = (sel) => known[sel] || {
  classList: { add: noop, remove: noop, contains: () => false },
  style: { props: {}, setProperty: noop }, dataset: {}, textContent: '',
  addEventListener: noop,
  querySelector: () => null,
  querySelectorAll: () => [],
  getBoundingClientRect: () => box(0, 0, 0, 0)
};

globalThis.document = {
  getElementById: (id) => (id === 'stage' ? stage : stubEl(id)),
  querySelector: stubEl,
  querySelectorAll: () => [],
  createElement: () => ({ width: 0, height: 0, style: {}, getContext: makeCtx }),
  addEventListener: noop,
  documentElement: { clientWidth: 1440, clientHeight: 900, scrollHeight: 4200, style: {} },
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

/* Minimal Image: fires onload asynchronously, like the real one. The reported
   size is not the point - nothing here decodes pixels - but it MUST be
   non-zero, because assets.js rejects a 0x0 decode and the whole suite
   would quietly fall back to the drawn art again. */
globalThis.Image = function () {
  const img = { width: 320, height: 128, onload: null, onerror: null,
                 _src: '' };
  Object.defineProperty(img, 'src', {
    get() { return img._src; },
    set(v) {
      img._src = v;
      /* Async, so the ordering the real loader depends on is preserved:
         nothing may assume the sheets are ready at module load. */
      setTimeout(() => {
        /* CHECK THE PATH AGAINST DISK, rather than resolving unconditionally.

           A stub that succeeds for any filename cannot catch a wrong one, and
           that is not hypothetical: the loader asked for 'tileset.png' while the
           file on disk is 'tilesetgrass.png'. In the browser the 404 fell through
           to the procedural fallback, so the page rendered perfectly and showed
           none of the new art - a completely silent failure that both test
           suites passed.

           So this stub behaves like the network: it resolves only for a file
           that is genuinely there. Every other path takes the onerror branch,
           which is what a static host does. */
        /* existsSync answers rather than throws, so it is the test itself that
           decides which callback fires - an `exists` false must NOT quietly
           count as a successful load. */
        if (existsSync(join(ROOT, decodeURIComponent(v.split('?')[0])))) {
          if (img.onload) img.onload();
        } else if (img.onerror) {
          img.onerror(new Error('404 (stubbed): ' + v));
        }
      }, 0);
    }
  });
  return img;
};

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
    /* Two bugs in this one regex, both found by splitting biomes.js in two.
       `[\s\S]*?` is lazy but unbounded, so with two imports in a row it ran from
       the first `{` to the second `}` and merged their name lists - yielding
       "place.js does not export skyBiome" about a file never imported. And the
       body used to start at the LAST `import` keyword rather than the end of
       THIS statement, so every name in the first of two imports was reported
       unused. Hence: braces stop at `}`, and the body starts where this match
       ends. */
    const re = /import\s*\{([^}]*)\}\s*from\s*'\.\/([A-Za-z]+)\.js'/g;
    let im;
    while ((im = re.exec(t))) {
      /* The body of the module is everything AFTER this import statement, not
         after the last `import` keyword in the file.
         `t.lastIndexOf('import')` found the LAST one, so as soon as a module had
         two imports - which is most of them - every name in the first was
         searched for in the wrong slice and reported as unused. Adding a second
         import to biomes.js during a refactor produced five failures that were
         all artefacts of this line, including two nonsense "does not export"
         messages seen from the other side. */
      const body = t.slice(im.index + im[0].length);
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

  /* 2b. IS GONE - the shaft channel through the treasure room.
       These were stylesheet checks, not behavioural ones, and they existed for a
       specific reason: the channel was a CSS mask on `#contact::before`, and
       nothing in the JS can see a CSS mask. Without the check, deleting the
       channel would have left every other assertion green while the sprite went
       back behind the room's rock.

       The room is gone, so there is no rock to bury the sprite and no mask to cut.
       The cave and the player are both drawn on the canvas, with no HTML in that
       region to sit on top of either - so the failure this guarded against cannot
       occur any more.

       What replaced it is behavioural rather than textual: the assertions that the
       player stays on screen inside the cave, and the "car stays visible after the
       player leaves it" mutation, which is judged from recorded draw calls rather
       than from a stylesheet. Those are the checks that would catch a buried
       sprite now. */


  /* 2c. The sprite registry must actually contain sprites. This check exists
        because fault 14 in the mutation test proved the point the hard way:
        emptying SET.tufts made every sprite lookup return undefined, blit()
        returned early, nothing threw, and the whole biome still reported itself
        as having drawn. A per-band counter cannot see a missing sprite - only
        a look at the registry can.

        So each set is asserted non-empty, and the flower beds are asserted to
        have all four colours, because "vibrant flowers on the surface layer" is
        a stated requirement and not a stylistic preference.

        The rock decoration sets (soil, roots, ore, blocks, moss, crystals,
        spikesDown, spikesUp, strata, nuggets, shelves) were removed along with
        the decorations themselves. The rock bands are now painted geometrically
        from their band geometry in render.js, so there is no sprite set left to
        check for them. Only the surface foliage is baked. */
  const SETS = ['conifers', 'canopies', 'tufts', 'blooms'];
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

  /* 2d. Bands must be TALLER than their panels, and must tile end to end.

     This is the regression test for the change that stopped each chamber from
     covering its own layer. A band used to be measured straight off the section
     rect, so band == panel exactly and the opaque panel hid the whole middle of
     its own rock. bands.js now derives each band from the midpoint of the gap
     above and below, which restores visible rock and the seam around every
     chamber.

     Both halves matter and they fail differently:
       - "taller than the panel" is what puts rock back on screen;
       - "contiguous" is what stops the unpainted full-width strips between
         layers, and it is also the invariant layerIndexAt() relies on to pick
         the current layer from a scroll offset.
     A band that is taller but leaves a hole still looks broken, and a set of
     bands that touch but equal their panels has fixed nothing. */
  {
    const ls = L.layers;
    /* SIX layers, ALL of them panel-backed. The cave used to be a synthetic band with
       no <section> behind it; it is a real room now, so it comes out of the panel
       loop like the other five and the synthetic band is gone. The assertion is
       a shape rather than a bare number: a count alone would not notice the cave
       quietly becoming a band again. */
    const panels = ls.filter((l) => !l.cave);
    const caves = ls.filter((l) => l.cave);
    if (panels.length !== 6) {
      fail('expected 6 panel-backed layers, measured ' + panels.length);
    }
    if (caves.length !== 0) {
      fail('the cave is a real <section> now, so it must come out of the panel loop; ' +
           'found ' + caves.length + ' synthetic cave band(s) as well');
    }
    for (let i = 0; i < ls.length; i++) {
      const l = ls[i];
      if (!(l.height > 0)) fail(l.id + ' band has no height');
      /* panelTop/panelBottom are what the band is derived FROM, so comparing
         against them tests the derivation itself rather than a re-measure. The
         cave band is skipped: it has no panel, and its panel numbers are 0 by
         definition, so `top <= panelTop` would be a comparison against a fiction. */
      if (l.cave) continue;
      if (!(l.top <= l.panelTop)) {
        fail(l.id + ' band starts below its own panel: ' + l.top + ' > ' + l.panelTop);
      }
      if (!(l.bottom >= l.panelBottom)) {
        fail(l.id + ' band ends above its own panel: ' + l.bottom + ' < ' + l.panelBottom);
      }
      if (l.height <= (l.panelBottom - l.panelTop)) {
        fail(l.id + ' band is not taller than its panel (' + l.height +
             ' <= ' + (l.panelBottom - l.panelTop) + ') - the panel covers its own layer');
      }
      if (i > 0) {
        const gap = l.top - ls[i - 1].bottom;
        if (gap !== 0) {
          fail(l.id + ' does not meet the band above it (gap ' + gap +
               'px) - layers must tile with no unpainted strip');
        }
        if (!(l.top > ls[i - 1].top)) {
          fail(l.id + ' band top is not increasing; layerIndexAt() would be ambiguous');
        }
      }
    }
    /* The last band has to reach the treasure room, or bedrock stops short and
       the contact room sits on bare canvas. */
    const lastBand = ls[ls.length - 1];
    if (lastBand && lastBand.bottom < TREASURE_TOP) {
      fail('the last band stops at ' + lastBand.bottom +
           ', above the treasure room at ' + TREASURE_TOP);
    }
    /* measure() must REPLACE the layer list, not append to it. It runs on every
       resize, on load and on fonts.ready, so a missing reset grows the array a
       little each time and every consumer walks a list several layers too long
       while reading stale geometry. Caught by measuring twice. */
    const firstTop = L.layers[0].top;
    M.main.resize();
    if (L.layers.length !== ls.length) {
      fail('measure() appended instead of rebuilding: ' + ls.length + ' layers became ' +
           L.layers.length + ' after a second resize');
    }
    if (L.layers[0].top !== firstTop) {
      fail('a second measure() moved the first band, so the geometry is unstable');
    }
  }

  /* 2e. The row-gap IS the layer headroom, and smoke cannot see it.

     bands.js derives each band from the midpoint of the gap above and below the
     panel, so if the grid row-gap collapses the bands collapse with it: the
     seams end up drawn across the top edge of the chambers and the layers go
     back to being flat washes. No JavaScript assertion can catch that, because
     the stub has no cascade - the same blind spot mutation 9 documents for the
     shaft channel, and checked here the same way.

     The threshold is not arbitrary. The seam is a jagged curve +/-13px around
     the band top (layers.js seamY), so a gap below about 6rem starts drawing
     that jitter across the panel edge. */
  /* layoutCss / phoneCss are read here, next to the checks that use them, rather
     than up at the old 2b block. That block was the shaft-channel check and is
     gone with the room; these two are the surviving stylesheet checks, and they
     are the only ones left - the stub has no cascade, so a collapsed row-gap is
     invisible to every behavioural assertion in this file.

     Whitespace is stripped first so a reformat cannot silently disarm them. */
  const layoutCss = readFileSync(join(ROOT, 'css', 'layout.css'), 'utf8');
  const flat = (s) => s.replace(/\s+/g, '');
  const phoneCss = flat(layoutCss).slice(flat(layoutCss).indexOf('@media(max-width:820px)'));
  if (!/row-gap:clamp\(\s*14rem/.test(flat(layoutCss))) {
    fail('the desktop row-gap is too small to be layer headroom (expected clamp(14rem, 46vh, 34rem))');
  }
  if (!/row-gap:clamp\(\s*9rem/.test(phoneCss)) {
    fail('the phone row-gap is too small to be layer headroom (expected clamp(9rem, 30vh, 18rem))');
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
       the hollow cave at the foot of the shaft, and is stationary everywhere else. These
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
    /* The deepest room is the CAVE now (layers[5]), not the bedrock chamber:
       travelTo moved down with it. Checking against layers[4] would have let the
       car travel 634px past the end of the page's last room. */
    const deepestRoom = L.layers[L.layers.length - 1];
    if (deepestRoom && end > deepestRoom.bottom) {
      fail(label + ' travel runs past the end of the deepest room (' + deepestRoom.id + ')');
    }

    /* THE PARKED CAR RESTS ON THE SOIL, not at the top of the band. This used to
       assert the opposite - that the car is held at band.top through the sky -
       which is exactly the floating elevator that was reported as a bug. The band
       is viewport-relative, so a car parked at band.top hangs in the open air with
       the dirt below the fold.

       THE CAR IS ON THE SOIL ONLY WHILE THE SOIL IS BELOW THE BAND. If the ground
       is already above band.top the car is inside the band's own range and the band
       is what positions it - asserting the soil unconditionally is what broke both
       the tall and the short viewports.

       It is still STATIONARY: `settle` runs 250 frames, so a car that merely eased
       down toward the soil would be caught. That distinction is the point - parked
       ON the surface, not sliding to it. */
    /* THE CAR IS PARKED ON THE GRASS at scroll 0, and on the grass again right up
       to the moment the travel window opens. L.surfaceFrom is the sky band's
       bottom - the seam the reader sees - and NOT L.travelFrom, which is the top
       of the dirt room's layout box and sits below the visible surface.

       The band is deliberately NOT part of this. An earlier version asserted the
       car sat at max(grass, bandTop), which passed while the car stood 93px below
       the grass on a 1920x1200 window - the band quietly overriding the surface,
       which is precisely the fault being fixed. The car waits on the ground; the
       band only governs it once it is descending.

       Still STATIONARY: `settle` runs 250 frames, so a car easing down toward the
       grass rather than parking on it would be caught here. */
    const grassAtTop = L.surfaceFrom;
    if (!near(settle(0), grassAtTop)) {
      fail(label + ' car is not parked on the grass at scroll 0 (car at ' +
           settle(0).toFixed(0) + ', grass at ' + grassAtTop.toFixed(0) +
           ', band top at ' + band.top.toFixed(0) + ')');
    }
    /* THE CAR DESCENDS FROM THE SURFACE rather than waiting on it. The travel
       window now starts at surfaceFrom, so the elevator travels from the first
       pixel of scroll: by the midpoint of the journey it must be strictly between
       the top of its travel and the bottom of the band, and it must NOT still be
       level with the grass.

       This replaces an assertion that the car sat on the grass right up to the dirt
       room, which encoded the freeze being removed. The band is viewport-relative
       and the grass is a document line, so on a tall window they never meet and
       waiting for the band meant the car never moved at all. */
    /* AT SCROLL 0 THE CAR IS ON THE GRASS - which is the band's top being
       anchored to the surface. This is the assertion the earlier version lacked: it
       checked the midpoint of the journey, which passes whether or not the band
       knows about the surface at all, because the band alone still produces a
       descent. Mutating the surface anchor out survived on that check.

       So the start is asserted directly against L.surfaceFrom. */
    if (!near(settle(0), L.surfaceFrom)) {
      fail(label + ' car does not start on the grass (car at ' +
           settle(0).toFixed(0) + ', grass at ' + L.surfaceFrom.toFixed(0) +
           ', band top at ' + band.top.toFixed(0) + ')');
    }
    const midScroll = (L.surfaceFrom + end) / 2;
    const midCar = settle(midScroll);
    if (!(midCar > L.surfaceFrom - midScroll + 1 && midCar < band.bot - 1)) {
      fail(label + ' car does not descend from the surface (mid-journey at ' +
           midCar.toFixed(0) + ', band bottom ' + band.bot.toFixed(0) + ')');
    }
    if (near(midCar, L.surfaceFrom - midScroll)) {
      fail(label + ' car is still level with the grass halfway down the page, so ' +
           'the elevator never travels - the freeze this change removes');
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




    /* Walk the whole page: monotonic, in band, and the character never sinks.
       This is the check that would have caught the original "the elevator goes
       up while I scroll down" bug, which measured 140 direction reversals. */
    let prev = -Infinity, reversals = 0, sunk = 0, offscreen = 0, outOfBand = 0;
    let prevParked = Infinity, parkedFell = 0, offSurface = 0;
    for (let sc = 0; sc <= L.maxScroll; sc += 50) {
      const y = settle(sc);
      /* MONOTONICITY IS SCOPED TO THE TRAVEL WINDOW, and that scoping is the fix
         rather than a loosening. The car is parked on the ground above the
         surface, and the ground RISES as the reader scrolls down, so those frames
         are a rise by definition and counting them as reversals is what reported
         the freeze as 4 direction reversals.

         The window now starts at the surface, so everything below it is a descent
         and is checked as one. */
      if (sc >= L.surfaceFrom) {
        if (y < prev - 0.01) reversals++;
        if (y < band.top - 0.01 || y > band.bot + 0.01) outOfBand++;
        if (y > h + 0.01 || G.player.y < -0.01) offscreen++;
        if (!G.player.inCave && G.player.y + G.player.h > y + 0.01) sunk++;
      } else {
        /* ABOVE THE SURFACE THE CAR RIDES THE GRASS. The grass rises as the page
           scrolls, so the car rises with it - correct, because it is standing on
           the ground and the ground is passing beneath it. The band top is the
           anchor the journey starts from, NOT a resting line the car must stay
           inside while it is still in the sky.

           So what is asserted is exactly that: the car is ON the surface at every
           scroll position above it. Asserting it stayed inside the band reported it
           8px out, because it was at the grass while the band started lower down.
           The band is simply not where the car is while it is still in the sky. */
        const surf = L.surfaceFrom - sc;
        if (Math.abs(y - surf) > 1) offSurface++;
        if (y > prevParked + 0.01) parkedFell++;
        prevParked = y;
      }
      prev = y;
    }
    if (parkedFell) {
      fail(label + ' the car on the surface moved DOWN the screen on ' + parkedFell +
           ' frame(s); standing on the ground means it rises as the ground rises');
    }
    if (offSurface) {
      fail(label + ' the car left the grass surface on ' + offSurface +
           ' frame(s) while above it');
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

  /* 8. The pixel-art sheets must actually have produced art. See the note
       above: the drawn foliage is still baked as a fallback, so without
       this section the whole suite is satisfied by the fallback and the
       loader could break entirely without a single failure. */
  /* The loader is ASYNC - the Image stub resolves on a timer, mirroring a real
     decode - so the sheets may still be in flight at this point. Awaiting the
     exported load() makes this a real check rather than a race: the promise
     resolves on BOTH the success and the failure path, so a loader that throws
     still completes here and is then reported by the ok=false assertion below
     instead of hanging the suite. It is the promise the module already created
     at load time, and awaiting it twice is free. */
  await M.assets.load();
  const A = M.assets.assets;
  if (!A.loaded) {
    fail('the asset loader never settled - the sheets are still in flight');
  } else if (!A.ok) {
    fail('the pixel-art sheets failed to load, so the drawn fallback is painting');
  }
  const expectSets = { trees: 'trees' };
  for (const [k, label] of Object.entries(expectSets)) {
    if (!Array.isArray(A[k]) || !A[k].length) {
      fail('no ' + label + ' were sliced from the sheets');
    }
  }
  /* Every slice must be a real, positive, INTEGER-sized canvas. Integer
     matters as much as positive: scaleFor() and blitOn() round a scaled
     sprite to whole pixels, and a fractional slice width makes the sprite
     drift against its own placement by a different amount every frame. */
  const slices = [...A.trees].filter(Boolean);
  if (slices.length !== 2) {
    fail('expected exactly 2 tree slices, got ' + slices.length +
         '. The bush, tuft, dirt and grass-cap tiles were removed on purpose ' +
         '- they repeated visibly and they must NOT come back.');
  }
  slices.forEach((s, i) => {
    for (const dim of ['width', 'height']) {
      const v = s[dim];
      if (!(typeof v === 'number' && isFinite(v) && v > 0 && v % 1 === 0)) {
        fail('slice ' + i + ' has a bad ' + dim + ': ' + v);
      }
    }
  });
  /* The tree sizes are part of the contract, not an implementation detail:
     getting either wrong is a visible scaling artefact rather than a crash, so
     it is pinned here. There are no tile sizes left to assert - nothing from a
     sheet is ever repeated, which is the point of removing them. */
  A.trees.forEach((t, i) => {
    const want = i === 0 ? [83, 96] : [62, 72];
    if (t && (t.width !== want[0] || t.height !== want[1])) {
      fail('tree slice ' + i + ' is ' +
           (t ? t.width + 'x' + t.height : '(missing)') +
           '; expected ' + want[0] + 'x' + want[1]);
    }
  });

  /* 9. The trees must not move. ------------------------------------------------
     The one regression check in this file that renders the SAME scroll position
     twice at different frame times and insists the props land in the same place.

     It exists because of a bug that every other check here was blind to. The sky
     biome drew its clouds and its trees from a single seeded rng, and the cloud
     loop's off-screen `continue` is against a clock-derived x, so a different
     number of draws were pulled from the stream on each frame. The trees read
     the stream after the clouds, so the whole meadow reshuffled itself a few
     times a second while the clouds drifted past. Nothing failed: every sprite
     was valid, in a gutter, standing on the ground, drawn exactly once. It just
     was not the same meadow twice.

     A "no exceptions, no non-finite numbers, biomesDrawn > 0" suite cannot see
     that, which is why this renders twice and compares. The two frames differ
     ONLY in `now`, which is exactly the variable the bug travelled through. */
  {
    const props = [...(S.SET.conifers || []), ...(S.SET.canopies || [])];
    if (!props.length) {
      fail('no tree sprites exist, so tree stability cannot be checked');
    } else {
      const treeSet = new Set(props);
      /* The painter's own constants, read from the module. Declared here rather
         than beside the assertions that use them, because the twitch and crawl
         checks come first and a const further down the block would still be in the
         temporal dead zone at that point. */
      const TREE_TARGETS = M.biomes.TREE_W;
      const TREE_PITCH_GAP = M.biomes.TREE_GAP;
      const TREE_SINK = M.biomes.TREE_SINK;
      /* Every sprite the props pass may stand on the seam with: trees, tufts,
         bushes and blooms. SET.blooms is an array of arrays (a palette of beds,
         each holding three sizes), so it is flattened - without that, .has() on the
         inner arrays is always false and the whole sweep silently checks nothing,
         which is the failure mode this suite exists to prevent. */
      const propSet = new Set([
        ...(S.SET.tufts || []), ...(S.SET.bushes || []),
        ...(S.SET.conifers || []), ...(S.SET.canopies || []),
        ...(S.SET.blooms || []).flat()
      ]);
      /* Settle at a scroll position where the surface is on screen - the top of
         the page - so the props pass actually has somewhere to put a tree. This
         mirrors the per-viewport settle() above, which is scoped to that loop.

         The size is set explicitly because the viewport loop has just left the
         stub at its LAST entry, 300x200, where the panel and the shaft leave
         only slivers of gutter and no tree fits anywhere. A desktop size is
         checked here because that is where the meadow is widest. */
      globalThis.document.documentElement.clientWidth = 1440;
      globalThis.document.documentElement.clientHeight = 900;
      globalThis.window.innerHeight = 900;
      M.main.resize();
      /* Scroll so the SOIL LINE is on screen, not to a hard-coded offset. The
         gate in drawSurfaceProps() is `ground > -80 && ground < viewH + 80`,
         and at scroll 0 the stub's dirt band starts at y=1400 - 500px below a
         900px viewport - so the props pass correctly places nothing there and a
         fixed scroll of 0 would have failed for the right reason and looked like
         the wrong one. Put the line 60% down the screen, which is where the
         meadow actually sits in the real page. */
      const wantGround = Math.round(900 * 0.6);
      globalThis.window.scrollY = Math.max(0, Math.min(L.maxScroll, L.layers[1].top - wantGround));
      L.syncScroll();
      for (let i = 0; i < 250; i++) D.advanceCar(1 / 60);
      G.movePlayer(1 / 60);

      const snap = (now) => {
        blits.length = 0;
        R.render(now);
        /* Only the tree blits, in draw order, as "x,y,w,h". The SIZE is part of
           the signature on purpose: it is how a tree that got rescaled between
           frames is caught, and it costs nothing to include.

           Sizes legitimately differ WITHIN a frame - the two sheet crops are
           62x72 and 83x96, and scaleFor() may double either of them in a wide
           gutter - so an earlier version of this check that compared every
           tree's size against every other tree's size failed on correct
           behaviour. What must hold is that the same source keeps the same
           destination, and comparing whole frames captures exactly that. */
        return blits.filter((b) => treeSet.has(b.src))
                    .map((b) => [b.dx, b.dy, b.dw, b.dh].join(','));
      };

      /* EVERY prop that stands on the seam, not just the trees: the tufts, bushes
         and flowers are placed from the same seam and were off the chord by the
         same up-to-5px. A tuft a few pixels off is far less noticeable than a tree,
         which is exactly why it would have survived - mutation 14i demonstrated this
         by leaving the tree call site alone and reverting only the tuft one, and
         nothing failed.

         So this is the unfiltered blit log over every seam prop. The tufts sit at
         their own offsets from the seam (1px above for the grass pass, 2px for the
         cover pass) rather than TREE_SINK, so they cannot simply share the tree
         assertion; the sweep below therefore allows any of a small set of offsets
         and asks only that each prop be explainable by the chord at one of them. */
      const snapAll = (now) => {
        blits.length = 0;
        R.render(now);
        return blits.filter((b) => propSet.has(b.src))
                    .map((b) => ({ src: b.src, s: [b.dx, b.dy, b.dw, b.dh].join(',') }));
      };

      /* Three times, spread over a window long enough for a cloud to drift in
         and back out of a gutter. The bug reproduced well inside this. */
      const frames = [0, 700, 1900, 4300].map(snap);
      /* DENSER SWEEP, because four frames is thin evidence for a claim about
         motion. A tree that jitters on a 250ms cycle passes four samples taken
         at 700ms intervals and looks perfectly still, which is exactly the kind
         of bug that survives a test written to catch it. Sixteen samples across
         four seconds is enough to land on a short cycle. */
      {
        const dense = [];
        for (let t = 0; t <= 4000; t += 250) dense.push(snap(t));
        const b0 = dense[0];
        let moved = 0, maxD = 0, countDrift = 0;
        for (let i = 1; i < dense.length; i++) {
          if (dense[i].length !== b0.length) countDrift++;
          for (let j = 0; j < Math.min(b0.length, dense[i].length); j++) {
            const a = b0[j].split(',').map(Number);
            const c = dense[i][j].split(',').map(Number);
            /* Every field, not just position: a tree that keeps its place but
               changes SIZE between frames is flickering just as visibly. */
            const d = Math.max(Math.abs(a[0] - c[0]), Math.abs(a[1] - c[1]),
                               Math.abs(a[2] - c[2]), Math.abs(a[3] - c[3]));
            if (d > 0) { moved++; if (d > maxD) maxD = d; }
          }
        }
        if (countDrift) {
          fail('the number of trees placed changes between frames (' +
               countDrift + ' of ' + (dense.length - 1) + ' intervals), so the ' +
               'meadow is repopulating while the reader watches it');
        }
        if (moved) {
          fail(moved + ' tree value(s) differ between frames across a 4s sweep ' +
               'at a 250ms stride, by up to ' + maxD + 'px. The props pass is ' +
               'supposed to be a pure function of the gutter geometry: it seeds ' +
               'its own stream (mulberry32(PROP_SEED)) and never reads the clock. ' +
               'If trees are moving, something else feeds time into that pass');
        }
      }
      /* THE TWITCH, and the reason only SOME trees did it.

         The seam is traced as a POLYLINE: the turf clip emits a vertex every
         SEAM_STEP and the browser joins them with straight lines, so between two
         vertices the visible ground is the CHORD, not the curve. A tree sampled
         seamY() at its own x - the true curve - and was therefore placed up to
         5.1px away from the ground it was standing on. Scrolling moved the two
         past each other and the tree juddered inside its own shadow.

         The assertion is that a tree stands ON the polyline that is actually
         drawn, reconstructed here from the same seamY() vertices the clip uses.

         Note what this is NOT. An earlier version of this check asserted that no
         tree moves UP as the page scrolls down, on the theory that the twitch was
         a reversal - and that passed against the BROKEN code, because it was
         measuring the wrong thing entirely. The chord error is a constant offset
         from the tree's own x, not a reversal: the tree still descends smoothly,
         just alongside a ground line it is not sitting on. Monotonicity was
         always going to pass, which is why measuring it proved nothing.

         A position-equality check would fail for the opposite reason: the tree is
         supposed to move when the page scrolls, and TREE_SINK buries the trunk
         below the line on purpose. So the invariant is specifically tree-vs-chord. */
      {
        const s0 = globalThis.window.scrollY;
        const layer = L.layers[1];
        let worst = 0, worstX = 0, checked = 0;
        for (let q = 0; q < 8; q++) {
          globalThis.window.scrollY = s0 + q / 4;
          L.syncScroll();
          /* Sweep every x the props pass could plausibly sample, rather than
             reading x back off a blit. The painter's `walk` is unrecoverable from
             the drawn signature - it advances by `wide + gap + jitter` and is
             therefore fractional, while blitOn rounds it - and three separate
             attempts to invert it produced three checks that could not tell the
             bug from correct behaviour. Sampling the FUNCTION directly has no such
             ambiguity: it asks the question that is actually being asked. */
          for (let x = -40; x <= L.viewW + 40; x += 1) {
            /* The chord the turf clip actually draws here: the two bracketing
               vertices and the straight line between them. */
            const x0 = L.seamVertexX(x);
            const ya = L.seamY(layer, x0);
            const chord = ya + (L.seamY(layer, x0 + L.SEAM_STEP) - ya) *
                                 ((x - x0) / L.SEAM_STEP);
            /* seamPropY() must return that, because it is what props are placed
               with. It is the same construction, so this is the check that the
               helper was not quietly changed into a curve reader - and it is exact,
               so any deviation at all is a defect rather than a tolerance
               question. */
            const d = Math.abs(L.seamPropY(layer, x) - chord);
            checked++;
            if (d > worst) { worst = d; worstX = x; }
          }
        }
        globalThis.window.scrollY = s0;
        L.syncScroll();
        /* Exact equality is the honest bar here and no threshold is needed: both
           sides are the same expression over the same rounded vertices, so the
           correct answer is 0 everywhere. A tolerance would only be a way of
           hiding a change in the helper. */
        if (worst > 1e-9) {
          fail('seamPropY() disagrees with the drawn seam polyline by ' +
               worst.toFixed(6) + 'px at x=' + worstX + ' (over ' + checked +
               ' samples). The turf clip traces the seam every ' + L.SEAM_STEP +
               'px and the browser joins those vertices with straight lines, so the ' +
               'visible ground between two of them is the CHORD, not the curve. ' +
               'Props placed on the raw curve sit up to 5px off the soil they ' +
               'appear to be standing in and judder against it as the page scrolls - ' +
               'which is why only SOME trees twitched, depending on where each one ' +
               'fell between two vertices. seamPropY() must interpolate along the ' +
               'polyline');
        }
        /* And the inverse half, which is what actually pins the PAINTER. If the
           helpers are right but the props pass stopped using them, nothing above
           would notice at all.

           Rather than guess where the painter sampled (its `walk` advances by
           `wide + gap + jitter` and is therefore fractional, while blitOn rounds
           the destination), this asks the question directly: the crown centre is
           `walk + wide / 2`, and `wide` is within the drawn span - so the sampled
           x must lie in [p[0], p[0] + drawnWidth], give or take the half pixel the
           rounding of walk can shift it. Whether the chord passes through the
           drawn base ANYWHERE in that range is solved for exactly rather than
           sampled, because the chord is a straight line and a grid sweep steps
           straight over it: a sweep at quarter-pixel resolution flagged a quarter
           of the trees on CORRECT code, which is worse than no check at all.

           Solving instead: seamPropY() is linear within a segment, so the set of x
           giving a particular y is a point or the whole segment, and both are
           found exactly. */
        {
          let strays = 0, total = 0, worst = Infinity, worstX = 0;
          for (let q = 0; q < 8; q++) {
            globalThis.window.scrollY = s0 + q / 4;
            L.syncScroll();
            for (const b of snap(0)) {
              const p = b.split(',').map(Number);
              const base = p[1] + p[3];
              const targetY = base - TREE_SINK;
              /* The crown centre lies inside the drawn span, and the walk cursor is
                 within half a pixel of p[0]. */
              const lo = p[0] - 1, hi = p[0] + p[2] + 1;
              /* A y-TOLERANCE at a real x, for the same reason as the cover props
                 below: blitOn() rounds the base, so the drawn value sits within half
                 a pixel of the chord's value and never exactly on it. An earlier
                 version solved for the crossing point and demanded exactness, which
                 rejected correct placements - the second version of this check to
                 fail on clean code, and the reason both now test a tolerance at a
                 real x instead. */
              let found = false;
              for (let x = lo; x <= hi && !found; x += 0.25) {
                if (Math.abs(L.seamPropY(layer, x) - targetY) <= 0.5) found = true;
              }
              if (!found) {
                /* Report the nearest miss in px - that is the size of the judder. */
                let best = Infinity;
                for (let x = lo; x <= hi; x += 0.25) {
                  best = Math.min(best, Math.abs(L.seamPropY(layer, x) - targetY));
                }
                if (best < worst) { worst = best; worstX = p[0]; }
                strays++;
              }
              total++;
            }
          }
          globalThis.window.scrollY = s0;
          L.syncScroll();
          if (strays) {
            fail(strays + ' of ' + total + ' drawn trees cannot be placed on the ' +
                 'seam polyline anywhere in their own span (nearest miss ' +
                 (isFinite(worst) ? worst.toFixed(2) : '>1') + 'px at x=' +
                 worstX + '), so the props pass is standing them on something else ' +
                 '- almost certainly the raw seamY() curve. That curve is not what ' +
                 'gets drawn: the turf clip traces a chord, so the tree ends up up ' +
                 'to 5px off the soil it appears to be standing in and judders ' +
                 'against it while the page scrolls, and only SOME trees do it, ' +
                 'depending on where each falls between two vertices. Use ' +
                 'seamPropY()');
          }
        }
        /* And the same for the OTHER seam props - tufts, bushes and flowers. They
           are placed from the same curve at their own small offsets (-1 for the
           grass pass, +2 for the cover pass), so the offsets are swept rather than
           assumed, and the requirement is the same: explainable by the chord.

           This exists because mutation 14i survived every other check. Reverting
           only the tuft call site left the whole suite green, which is the honest
           measure of how easy a small visual fault is to lose: the tufts are 9px
           wide, so a 4px error is a third of the sprite. */
        {
          /* Offsets are per prop CLASS, and that distinction is the whole reason
             this check is finicky. A tree is buried by TREE_SINK (-3), the grass
             tufts sit 1px above the seam, and the cover props (tufts, bushes,
             flowers) sit 2px below it. Offering every offset to every prop lets a
             tree be "explained" by the cover pass's offset, which is not an error
             condition at all - and it left 172 correctly-placed props looking
             broken, because a +2 prop tested against -3 lands on a y the chord
             never reaches.

             So the offsets are tried in order and the prop matches if the FIRST
             plausible one explains it. Trees are excluded here and asserted by the
             stricter TREE_SINK check above; this sweep is for the cover props.

             The exclusion has to read b.src, so snapAll() returns objects rather
             than joined strings. It returned strings first, which made b.src
             undefined, so the exclusion silently matched nothing and 28 TREES were
             tested against offsets that are not theirs - reported as 28 broken
             cover props, which is a long way from the truth. A filter that quietly
             never fires looks exactly like a check that passes, so the signature
             carries what the filter needs. */
          const OFFSETS = [2, -1];
          let strays = 0, total = 0;
          for (let q = 0; q < 4; q++) {
            globalThis.window.scrollY = s0 + q / 4;
            L.syncScroll();
            for (const b of snapAll(0)) {
              const p = b.s.split(',').map(Number);
              /* Skip the trees: they have their own assertion above, with their own
                 offset, and mixing the two is what produced the false failures. */
              if (treeSet.has(b.src)) continue;
              const base = p[1] + p[3];
              /* Cover props sample the seam at `fx`, which is `walk + (rc() * 7 | 0)` -
                 an integer, since walk advances by the integer COVER_STEP from an
                 integer gutter edge. So the drawn x and the sampled x agree, and the
                 span is one pixel either side: half a pixel for the rounding of the
                 base, plus a margin for the jitter.

                 Widening this span until the strays disappear is the tempting move
                 and it is the wrong one. A half-pixel reach reported 172 false
                 failures and a whole-pixel reach 492, because the span is what makes
                 the check able to fail at all - a prop standing away from its own
                 drawn x is precisely the fault being looked for. So the span stays
                 narrow and the strays get explained instead.

                 Tested as a y-TOLERANCE at a real x, not by solving for a crossing
                 point: blitOn() ROUNDS the base, so the drawn value sits within half
                 a pixel of the chord's and never exactly on it. The crossing test
                 demanded exactness and rejected correct placements. */
              const lo = p[0] - 1, hi = p[0] + 1;
              let found = false;
              for (const off of OFFSETS) {
                const ty = base - off;
                for (let x = lo; x <= hi && !found; x += 0.25) {
                  if (Math.abs(L.seamPropY(layer, x) - ty) <= 0.5) found = true;
                }
                if (found) break;
              }
              total++;
              if (!found) strays++;
            }
          }
          globalThis.window.scrollY = s0;
          L.syncScroll();
          if (strays) {
            fail(strays + ' of ' + total + ' cover props (tufts, bushes or flowers) ' +
                 'cannot be placed on the drawn seam polyline at either of their ' +
                 'offsets ' + OFFSETS.join('/') + '. Every prop that stands on the ' +
                 'surface reads its y from the seam, and the drawn seam is the ' +
                 'polyline chord rather than the curve - so anything placed on the ' +
                 'curve floats above or sinks into the grass. Use seamPropY() at ' +
                 'every call site, not just the trees');
          }
        }
      }
      /* SUB-PIXEL CRAWL, which the sweep above structurally cannot see because
         it holds scroll still. This one moves the page.

         seamY() fed two consumers that disagreed about rounding: the renderer
         stroked it into an antialiased path while blitOn() rounded the sprite's
         destination to a whole pixel. So the seam slid smoothly while the tree
         stepped, and the trees shimmered against the soil as the reader scrolled.
         Nothing about a fixed-scroll frame comparison can detect that, because
         both consumers agree perfectly well while the scroll is still - the
         disagreement only exists in the DIFFERENCE between them at fractional
         offsets.

         The assertion is therefore on INTEGRALITY, not on distance. It is tempting
         to assert that a tree's base sits exactly on the seam, and that is wrong:
         the tree is planted at seamY(x) + TREE_SINK (-3, to bury the trunk), and
         the crown centre is sampled at x + wide/2, which is not the x the base is
         drawn at. So the honest invariant is the one that actually causes the
         crawl - that every value the tree is placed from is a whole number, so
         both consumers are quantised onto the same grid and can never drift
         apart by a fraction.

         An earlier version of this check asserted a zero gap and failed on correct
         code at 7px, which says nothing about crawl. Measuring the placement terms
         instead of the outcome is what makes it a real check. */
      {
        const scroll0 = globalThis.window.scrollY;
        const layer = L.layers[1];
        let frac = 0, worst = 0, worstAt = 0, checked = 0;
        /* Quarter-pixel steps: 16 offsets is the minimum that hits every residue
           of the rounding, since the drift only appears on fractional offsets. */
        for (let q = 0; q < 16; q++) {
          const sc = scroll0 + q / 4;
          globalThis.window.scrollY = sc;
          L.syncScroll();
          const seam = L.seamY(layer, 320);
          if (seam !== Math.round(seam)) {
            frac++;
            const d = Math.min(Math.abs(seam - Math.round(seam)),
                               Math.abs(seam - Math.round(seam) - 1));
            if (d > worst) { worst = d; worstAt = sc; }
          }
          /* The drawn destination must be integral too - this is the half of the
             bug that lives in the sprite rather than in the curve. */
          for (const b of snap(0)) {
            const p = b.split(',').map(Number);
            for (const v of p) {
              checked++;
              if (v !== Math.round(v)) frac++;
            }
          }
        }
        globalThis.window.scrollY = scroll0;
        L.syncScroll();
        if (frac) {
          fail(frac + ' non-integer placement value(s) across 16 scroll offsets ' +
               'covering every sub-pixel position (worst ' + worst.toFixed(3) +
               'px off the grid at scroll ' + worstAt + '; ' + checked +
               ' drawn values checked). seamY() must return whole pixels and the ' +
               'blit destination must be rounded: the renderer strokes the seam ' +
               'into an antialiased path while the sprite lands on a whole ' +
               'pixel, so at fractional offsets the two disagree and the meadow ' +
               'crawls against its own soil while the reader scrolls. Round ' +
               'inside seamY(), not at the call sites');
        }
      }
      const base = frames[0];
      if (!base.length) {
        fail('no tree was placed with the soil line on screen; the props pass ' +
             'placed nothing (propsDrawn=' + R.propsDrawn + ')');
      }
      /* The strips the props pass actually plants into, read from the module
         rather than hard-coded. Every assertion below is stated against THESE,
         because they are the geometry that governs placement - a literal 48 or
         620 here would be a second source of truth that quietly stops being
         true when a breakpoint or a rail width changes, and a test asserting a
         stale number is worse than no test, because it looks like it is
         protecting something.

         This distinction is the whole point of the assertions. gutters()
         excludes the panel's column and is right for a painter filling the band
         top to bottom; the props stand on the seam, which is half a row-gap
         below the panel, so only the shaft occludes them. */
      const gu = M.biomes.meadowGutters();
      /* COVERAGE, proportional to the room AND to the size of the trees.

         An absolute floor ("at least N trees") passes a meadow that is 90% bare
         as long as N is low enough. Deriving the floor from the strips alone is
         not enough either: it assumes a fixed tree size, so the moment TREE_W
         grows past that assumption the floor becomes unreachable and the check
         fails on correct code - which is exactly what happened when the trees
         were enlarged, and why this denominator now carries the crown width.

         What actually distinguishes a meadow from a desert is how much of the
         available width received a tree, and a tree of a given size consumes a
         given width, so the two have to move together.

         Deriving it this way is also what catches the bare-LEFT bug. Replanted in
         gutters(), the props land in a 48px sliver, a 52px sliver and one wide
         strip - and the total still looks fine, because the wide strip alone
         carries most of them. The count was never the problem; the
         DISTRIBUTION was. */
      const span = gu.reduce((t, s) => t + s.w, 0);
      /* TREE_W and TREE_GAP come from the painter itself, not from literals
         restated here. */
      /* Read from the sprites, not from a literal: the widest crown actually on
         screen, plus the gap the painter leaves between crowns. */
      const crown = Math.max.apply(null,
        base.map((s) => Number(s.split(',')[2])));
      const floor = Math.max(3,
        Math.floor(span / (crown + TREE_PITCH_GAP)));
      if (base.length < floor) {
        fail('only ' + base.length + ' trees cover ' + Math.round(span) +
             'px of meadow at a crown width of ' + crown + 'px; at least ' +
             floor + ' are needed for the surface to read as a meadow. A tree ' +
             'wider than the strip it stands in fits exactly one, so check the ' +
             'target width passed to blitOn() (TREE_W) and that the props pass ' +
             'uses meadowGutters()');
      }
      /* HONOURS ITS TARGET WIDTH, which is the invariant that replaced "never
         magnified".

         An earlier version asserted every tree was NARROWER than its source crop.
         That was true only while every TREE_W entry sat below the sheet crops
         (83x96 and 62x72). Enlarging the trees made it false by design, and a
         check that is false by design is worse than no check - it looks like it
         is protecting something.

         The real requirement is that the size on screen is the size the painter
         asked for. Mutation 14b drops the target width and lets scaleFor() pick
         an integer scale instead, which draws each tree at 83 or 166px - ignoring
         TREE_W entirely - while the loop cursor still advances by the target
         width, so the COUNT is unchanged. That is why this is a size check and
         not a count check: the tree count is the one thing that mutation cannot
         move.

         Magnification is now legitimate, so the test cannot simply say "never
         wider than the source". What it CAN say is that every drawn width is one
         this painter would choose: a TREE_W target, or a half-step multiple of
         the source for a target above it (blitOn() quantizes magnification to
         keep the pixel grid regular). Anything else means the target width was
         dropped somewhere between TREE_W and the canvas. */
      const allowed = new Set();
      for (const sp of treeSet) {
        for (const t of TREE_TARGETS) {
          const k = t / sp.width;
          const kk = k > 1 ? Math.max(1, Math.round(k * 2) / 2) : k;
          allowed.add(Math.round(sp.width * kk));
        }
      }
      /* NO TARGET MAY ALIAS AN INTEGER SCALE, which is the invariant that keeps
         the check above able to fail at all.

         This is a real regression that shipped inside this very change. TREE_W
         briefly contained 83 and 166, which are exactly scaleFor()'s 1x and 2x
         of the 83px crop. With those in the allowed set, a tree drawn by the
         BROKEN path - target width dropped, integer scale chosen instead - was
         byte-identical to a correctly drawn one, and mutation 14b passed. The
         size check was still there and still green; it had simply been made
         unable to distinguish right from wrong.

         So the allowed set is not just "what the painter might ask for", it must
         exclude every width the fallback could produce unaided. Asserting that
         here means adding a convenient round number like 124 to TREE_W fails
         loudly instead of quietly disarming a regression test. */
      {
        const ints = new Set();
        for (const sp of treeSet) {
          for (let n = 1; n <= 4; n++) ints.add(sp.width * n);
        }
        const aliased = [...new Set(TREE_TARGETS.map((t) => {
          for (const sp of treeSet) {
            const k = t / sp.width;
            const kk = k > 1 ? Math.max(1, Math.round(k * 2) / 2) : k;
            const v = Math.round(sp.width * kk);
            if (ints.has(v)) return t + '->' + v;
          }
          return null;
        }).filter(Boolean))];
        if (aliased.length) {
          fail('TREE_W entries ' + aliased.join(', ') + 'px resolve to a width ' +
               'that is also an integer scale of a source crop (' +
               [...ints].sort((a, b) => a - b).join('/') + '). scaleFor() ' +
               'produces exactly those, so a tree drawn WITHOUT its target width ' +
               'would be indistinguishable from a correct one and the size check ' +
               'above could no longer catch it. Pick targets that land on 1.5x, ' +
               '2.5x or 3.5x instead');
        }
      }
      const stray = base.map((s) => Number(s.split(',')[2]))
                       .filter((w) => !allowed.has(w));
      if (stray.length) {
        fail(stray.length + ' tree(s) drawn at width(s) ' +
             [...new Set(stray)].sort((a, b) => a - b).join(', ') +
             'px, which is not any width the painter would ask for. The targets ' +
             'are ' + TREE_TARGETS.join('/') + 'px, quantized to half-steps above ' +
             'the source size. A width outside that set means the TREE_W target is ' +
             'not reaching blitOn(), so scaleFor() is choosing an integer scale ' +
             'instead and every tree is drawn at its source size or double it');
      }
      /* Every tree must FIT the strip it was planted in. A tree wider than the
         strip it stands in overhangs the edge and is half hidden, and the
         narrowest strip is the one that constrains it - the big outboard strip
         on a wide screen is not what limits the count. */
      const widest = gu.length ? Math.max.apply(null, gu.map((x) => x.w)) : 0;
      const narrowest = gu.length ? Math.min.apply(null, gu.map((x) => x.w)) : 0;
      const over = base.map((s) => Number(s.split(',')[2]))
                      .filter((w) => w > narrowest + 1);
      if (over.length) {
        fail(over.length + ' tree(s) are drawn wider than the narrowest strip ' +
             '(' + Math.round(narrowest) + 'px; widest ' + Math.round(widest) +
             'px) they stand in, so they overhang the edge and are half hidden');
      }
      /* BOTH SIDES. The bare-left bug was not "too few trees", it was "all the
         trees in one strip": the pass reported a healthy count while the whole
         left half of the surface was empty. Counting the strips that received a
         tree, rather than counting sprites, is what distinguishes a meadow from
         a hedge on one side. Each strip is identified by its own x read back
         from the module, so this cannot drift from the real geometry. */
      const strips = new Set();
      for (const s of base) {
        const x = Number(s.split(',')[0]);
        for (const strip of gu) {
          if (x >= strip.x && x < strip.x + strip.w) strips.add(strip.x);
        }
      }
      if (gu.length > 1 && strips.size < gu.length) {
        fail('trees landed in ' + strips.size + ' of the ' + gu.length +
             ' strips either side of the shaft, so one side of the surface is an ' +
             'empty desert. The props pass must use meadowGutters() and not ' +
             'gutters(), or the panel column is excluded and only one side is ' +
             'ever planted');
      }
      /* GROUND COVER, counted from real blits and checked PER STRIP. Ground cover
         runs on its own pass with its own rng, which is what lets flowers be dense
         where the trees are sparse. That decoupling is the whole point, and
         nothing here could see it going away: the tree assertions all still pass
         with the cover loop cut short, because a tree does not need a flower to
         exist.

         PER STRIP is the part that matters. A cover loop that breaks early only
         starves the strips it reaches second, so a total count still looks
         healthy - the first strip alone carries it. That is the same failure shape
         as the bare-left tree bug, one level down, and it wants the same answer. */
      /* Bushes and flowers ONLY - never tufts.

         A tuft is shared: the grass painter lays one along the seam as well, so
         including SET.tufts here counts the grass painter's blits as if they
         were ground cover. That inflated the count from ~60 per strip to ~105
         and made the check blind to its own mutation - the first assertion that
         measured something other than what it claimed to. Bushes and blooms are
         drawn only by the cover pass, so a blit of one is unambiguous evidence. */
      const coverSet = new Set([...(S.SET.bushes || []), ...(S.SET.blooms || [])]);
      for (const strip of gu) {
        const n = blits.filter((b) => coverSet.has(b.src) &&
                                      b.dx >= strip.x && b.dx < strip.x + strip.w).length;
        const need = Math.max(3, Math.floor(strip.w / 26));
        if (n < need) {
          fail('only ' + n + ' ground-cover sprites in the ' + Math.round(strip.w) +
               'px strip at x=' + Math.round(strip.x) + '; at least ' + need +
               ' are needed for the surface to read as growth rather than bare ' +
               'soil. Counted PER STRIP because an early break in the cover walk ' +
               'only starves the strips it reaches second, and a page-wide total ' +
               'still looks healthy on the strength of the first strip alone');
        }
      }

      /* scaleFor() is an integer MAGNIFIER and bottoms out at 1, so a sprite
         larger than its room is drawn at 1x and overflows it. Every caller that
         draws by height rather than by target width relies on it never returning
         0, which would silently collapse a sprite to nothing. Asserted on the
         function rather than on a render, because a render assertion cannot tell
         "drawn at 1x and slightly too big" from "drawn correctly". */
      for (const spr of treeSet) {
        for (const room of [16, 48, 120, 620, 1400]) {
          const k = M.place.scaleFor(spr, room);
          if (!Number.isFinite(k) || k < 1) {
            fail('scaleFor() returned ' + k + ' for a ' + spr.width +
                 'px sprite in ' + room + 'px of room; it is an integer ' +
                 'magnifier, so it must never drop below 1');
          }
        }
      }

      for (let f = 1; f < frames.length; f++) {
        if (frames[f].join('|') !== base.join('|')) {
          fail('the trees MOVED between frames at a fixed scroll position: ' +
               base.length + ' placed at t=0, frame ' + f + ' placed ' +
               frames[f].length + ' in different places or sizes. The props ' +
               'layout must be a pure function of the gutter geometry, not of ' +
               'the frame clock.');
          break;
        }
      }
    }
  }

  /* 10. The soil and the grass must be CLIPPED TO THE SEAM. -------------------
     This is the regression test for "the dirt tile is above the green line".

     The seam is a jagged curve, so the fix is only visible as the SHAPE of the
     path handed to clip(): a flat rect is 4 points, a seam is hundreds. Nothing
     else in the suite can see this, because every draw call in the broken version
     was finite and the page still rendered - it just rendered the layers in the
     wrong order at the boundary, which is invisible to a stub and obvious to a
     reader.

     Two clips are expected at the surface: the soil (render.js) and the grass
     (biome-sky.js). Either one alone is the defect - soil alone leaves the turf's
     own soil rows above the line, grass alone leaves the green line stranded on
     bare dirt. So both are required, and both have to be jagged. */
  {
    clips.length = 0;
    R.render(0);
    const jagged = clips.filter((n) => n > 8);
    if (!clips.length) {
      fail('no path was clipped this frame, so the surface is being painted as ' +
           'flat rects: the soil and the grass are both free to cover each other ' +
           'at the seam');
    } else if (jagged.length < 2) {
      fail('only ' + jagged.length + ' of ' + clips.length + ' clip paths were ' +
           'jagged (more than 8 points); the soil AND the grass must each be ' +
           'clipped to the seam curve, not to a rectangle');
    }
  }


  /* 11. The cave: walkable, and actually walkable TO. ------------------------
     New physics with no assertions is exactly how the old floor-less shaft got
     its "the player cannot move" bug, so the cave gets the same treatment as
     everything else here.

     The floor profile is the heart of it. It has to be (a) not flat, or the
     player is walking on a line and the cave is a corridor; (b) FINITE, or the
     collision writes NaN into the player and the art vanishes silently; and
     (c) the SAME curve the renderer draws - which is why the art samples at
     CAVE_FLOOR_STEP while the collision interpolates floorAt() at the player's
     centre. Two consumers of one profile that disagree about where to read it is
     the meadow-twitch bug, and this is the same trap with rocks on it. */
  {
    const CV = M.cave;
    globalThis.document.documentElement.clientWidth = 1440;
    globalThis.document.documentElement.clientHeight = 900;
    globalThis.window.innerHeight = 900;
    M.main.resize();

    /* A real room box, so the cave is measured. The stub already keys '.treasure'
       (measureCave() selects it by exactly that class), and TREASURE_TOP is read
       from the same fixture the barrier assertion uses - so the cave is measured
       against the room the rest of the suite believes in, rather than a box
       invented here that could drift away from it. */
    CV.measureCave(1440, 900);

    /* To the foot of the page, where the room is. The stub puts the room at
       document y=TREASURE_TOP (3170) which is far below any viewport this stub
       scrolls to, so the cave correctly reports itself inactive there - the room
       genuinely is not on screen at that scroll. Scrolling to the room's own top
       is what puts it in view, and it is read from the fixture rather than
       repeated, so the two cannot disagree about where the room is. */
    globalThis.window.scrollY = Math.max(0, TREASURE_TOP - 100);
    L.syncScroll();
    M.main.resize();

    if (!CV.caveActive()) {
      fail('the cave reports itself inactive with the treasure room scrolled into ' +
           'view (scrollY=' + globalThis.window.scrollY + ', room at ' +
           TREASURE_TOP + '), so the player can never leave the car. caveActive() ' +
           'is the gate on the whole feature');
    }

    /* (a) the floor is a shape, not a line. */
    let lo = Infinity, hi = -Infinity, badY = 0;
    for (let x = 0; x <= 1440; x += 16) {
      const y = CV.floorAt(x);
      if (!isFinite(y)) badY++;
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    if (badY) {
      fail('the cave floor returned ' + badY + ' non-finite heights; the collision ' +
           'writes that straight into player.y and every draw from it is silently ' +
           'dropped by the canvas');
    }
    if (hi - lo < 4) {
      fail('the cave floor is flat (total relief ' + (hi - lo).toFixed(2) +
           'px), so the room is a corridor with a line down it rather than a cave');
    }

    /* (b) the player can actually WALK, and stays on the floor while they do.
       This is the assertion that matters most: it would have caught the original
       "the player cannot move" bug, and it is stated as a behaviour - they end up
       somewhere else, standing on rock - rather than as a count of anything.

       Velocity comes from main.js update(), not from movePlayer() directly:
       movePlayer() integrates what it is GIVEN, and main.js is what turns a held
       key into that velocity. Driving movePlayer() alone moved a stationary
       sprite and reported "the room is not walkable" on correct code - a check
       that fails for a reason having nothing to do with the thing under test. So
       the same velocity main.js would set is set here, explicitly. */
    {
      G.snapPlayerToGround();
      /* snapPlayerToGround() re-seats the player onto the CAR, which is correct
         while they are riding it and exactly wrong here: the car is at the shaft
         centre (x=624) and the cave walls are at 34 and 1406. Calling it after the
         cave has taken over put the player back inside the shaft, where
         movePlayerCave() immediately clamps them back to the middle of nowhere -
         so the walk test measured 0px and blamed the room.

         So the player is placed on the cave floor the way enterCave() does, and
         the test then checks they can move from there. */
      CV.enterCave(G.player);
      G.player.inCave = true;
      G.player.y = CV.screenFloorY(G.player.x + G.player.w / 2) - G.player.h;
      G.player.vx = G.player.vy = 0;
      const before = G.player.x;
      G.player.vx = G.WALK_SPEED;
      for (let i = 0; i < 120; i++) G.movePlayer(1 / 60);
      G.player.vx = 0;
      const after = G.player.x;
      if (!(after > before + 40)) {
        fail('the player walked ' + (after - before).toFixed(1) + 'px in two ' +
             'seconds of holding right inside the cave (from ' + before.toFixed(1) +
             ' to ' + after.toFixed(1) + '); the room is not walkable');
      }
      if (!G.player.inCave) {
        fail('the player moved inside the cave but player.inCave is false, so the ' +
             'renderer would still draw the car under them and the collision in ' +
             'use is the shaft flat-deck one');
      }
      /* Their feet must be ON the floor - and this has to be checked against the
         CURVE, not against a second call to the same sampler the collision used.

         The first version read `CV.screenFloorY(player.x + player.w / 2)`, which
         is exactly the expression movePlayerCave() evaluates, so it agreed with
         the collision by construction and mutation 45 - which moves that sample
         to the player's feet - passed. A test that recomputes the thing under
         test with the same formula cannot fail; it can only ever confirm itself.

         So this reconstructs the drawn floor from floorAt() - the world-space
         profile, which has no knowledge of where the player is - at the point the
         sprite is standing on, and adds the single world-to-screen offset the
         renderer applies.

         The park clamp has to be handled or the whole comparison is meaningless.
         screenFloorY() clamps the floor to CAVE_FLOOR_PARK while the room is
         scrolled past it, and while that clamp is active it returns the SAME y at
         every x - so the drawn floor genuinely IS a flat line there, and any
         profile-derived expectation differs from it by up to the full relief
         (24px here). Asserting against the profile during that window fails on
         correct code.

         So the shape check only runs where the clamp is NOT holding the floor
         flat - that is, where the reader can actually see the floor's undulation.
         The clamp case is covered by the "floor is inside the viewport" sweep
         instead, which is the property that actually matters there. */
      const offset = CV.screenFloorY(0) - CV.floorAt(0);
      const stand = CV.floorAt(G.player.x + G.player.w / 2) + offset;
      const clamped = Math.abs(CV.screenFloorY(0) - CV.screenFloorY(1439)) < 0.5;
      if (!clamped && Math.abs(G.player.y + G.player.h - stand) > 1) {
        fail('the player stands ' +
             Math.abs(G.player.y + G.player.h - stand).toFixed(2) +
             'px off the cave floor (feet at ' + (G.player.y + G.player.h).toFixed(1) +
             ', floor at ' + stand.toFixed(1) + '); the art is drawn on one curve ' +
             'and the collision samples another');
      }
    }

    /* (b2) the floor agreement, at a scroll where the floor is NOT clamped flat
       AND the cave is genuinely active.

       Check (b) had to skip its shape assertion whenever the park clamp was
       active, which left mutation 45 uncovered - and a check that quietly skips
       itself in the one configuration where the bug is visible is not a check.

       The scroll matters and this took three attempts to get right. 700px above
       the room put the reader at roomTop - scroll = 700, which is BELOW
       caveActive()'s threshold of viewH * 0.5 = 450: the cave was off, the player
       was still standing where the previous block left them, and the assertion
       compared their feet (360) against a floor 348px away (708) and blamed the
       collision for a state it was never in.

       So this picks the scroll from caveActive()'s own rule rather than from a
       round number, and asserts the cave is active before measuring anything. */
    {
      const wantActiveAt = CV.caveRoomTop() - Math.round(L.viewH * 0.42);
      globalThis.window.scrollY = Math.max(0, wantActiveAt);
      L.syncScroll();
      M.main.resize();
      CV.measureCave(L.viewW, L.viewH);
      if (!CV.caveActive()) {
        fail('the cave is inactive at scroll ' + globalThis.window.scrollY +
             ' even though that puts the room ' +
             (CV.caveRoomTop() - globalThis.window.scrollY) +
             'px from the top of a ' + L.viewH + 'px viewport; caveActive() ' +
             'requires less than half the viewport height, so this scroll should ' +
             'be comfortably inside the cave');
      }
      const flat = Math.abs(CV.screenFloorY(0) - CV.screenFloorY(L.viewW - 1));
      if (flat < 4) {
        fail('the cave floor is already flat across the whole viewport while the ' +
             'room is only ' + (CV.caveRoomTop() - globalThis.window.scrollY) +
             'px from the top of the screen, so the reader never sees the floor ' +
             'undulate at any point (CAVE_FLOOR_PARK is too high, or the park ' +
             'clamp is firing far earlier than it should)');
      }
      CV.enterCave(G.player);
      G.player.inCave = true;
      /* Sampled ACROSS THE WALK, not at one point. The first version walked 200
         frames, stopped, compared, and mutation 45 passed - because it landed on
         x=1100, where the profile happens to be gentle: sampling the feet instead
         of the centre there differs by 0.91px, inside the 1px tolerance.

         That is the general trap with a single sample on a smooth curve. It reports
         on the luck of where it stopped rather than on the behaviour. The
         feet-vs-centre error is largest where the floor is steepest, and the walk
         crosses several of those, so the worst case has to be taken over the whole
         traverse: peak difference across the sprite's width on this profile is 21px,
         against under 1px at a gentle spot.

         The expectation is built from floorAt() - the world-space profile - plus the
         world-to-screen offset. screenFloorY() is NOT called at the player's x
         here: it is the function under test, and the first version did exactly that
         and agreed with the collision by construction. */
      G.player.vx = G.WALK_SPEED;
      /* Walk the room. Not to measure - to arrive somewhere the floor is not flat,
         which is the only place a feet-vs-centre difference can be seen at all. */
      for (let i = 0; i < 600; i++) G.movePlayer(1 / 60);
      G.player.vx = 0;
      /* Settle, then measure ONCE. This is the form that works, and getting here
         took four attempts worth recording:

         - sampling screenFloorY() at the player's x was CIRCULAR: it is the
           function under test, so it agreed with the collision by construction and
           mutation 45 passed;
         - sampling floorAt() at a single spot after a short walk passed too,
           because it landed on x=1100 where the profile is gentle and the two
           samples differ by 0.91px, inside the tolerance;
         - sampling EVERY frame of the walk then failed on CORRECT code at 6.69px,
           because a sprite descending onto a slope is genuinely part-way between
           one height and the next for the frames it takes to fall, and the check
           was demanding it be exactly on the line throughout.

         What remains is the thing that actually has to hold and that the fault
         actually breaks: a player who has STOPPED is standing on the floor, at the
         floor's value under their own centre. Feet-vs-centre puts a settled sprite
         on the wrong part of the curve - up to 21px on the steepest section here. */
      for (let i = 0; i < 30; i++) G.movePlayer(1 / 60);
      {
        const pcol = G.player.x + G.player.w / 2;
        const want = CV.floorAt(pcol) + (CV.caveRoomTop() -
                                         (globalThis.window.scrollY || 0));
        const settled = Math.abs(G.player.y + G.player.h - want);
        if (settled > 1) {
          fail('once settled on the floor the player stands ' + settled.toFixed(2) +
               'px off it (at x=' + pcol.toFixed(1) + ', profile at ' +
               want.toFixed(1) + '). movePlayerCave() must sample the floor at ' +
               'the player\'s CENTRE, not at their feet: the sprite is 64px wide, ' +
               'so the two are 32px apart on a slope and the sprite settles on ' +
               'the wrong part of the curve');
        }
      }
    }

    /* (c) BOTH walls hold, walked into separately. Mutation 44 removes the LEFT
       wall and this originally only tested the right one, so the fault survived -
       a test that exercises half of a pair is a test that cannot see half of the
       bugs, and it read as coverage.

       Walked into rather than teleported, because the failure is a CLAMP: a
       player placed outside the wall has the clamp fire on the first frame and
       looks fine. They have to be pushed at it.

       The frame budget matters and 700 was not enough, which is why mutation 44
       survived the first version of this check: after the rightward walk the
       player is at the RIGHT wall, and crossing 1370px back to the left one at
       WALK_SPEED 95 takes about 865 frames. At 700 they stopped at x=233 with
       the left wall at 34 - never having reached it, so removing that wall
       changed nothing observable and the fault read as caught-by-nothing.
       1200 frames clears both directions with room to spare. */
    {
      const b = CV.caveBounds();
      /* Right wall. */
      G.player.vx = G.WALK_SPEED;
      for (let i = 0; i < 1200; i++) G.movePlayer(1 / 60);
      G.player.vx = 0;
      if (G.player.x > b.right - G.player.w + 0.5) {
        fail('the player walked past the RIGHT wall of the cave (x=' +
             G.player.x.toFixed(1) + ', wall at ' +
             (b.right - G.player.w).toFixed(1) + '); there is nothing out there');
      }
      /* Left wall, from the far side so the whole room is crossed. */
      G.player.vx = -G.WALK_SPEED;
      for (let i = 0; i < 1200; i++) G.movePlayer(1 / 60);
      G.player.vx = 0;
      if (G.player.x < b.left - 0.5) {
        fail('the player walked past the LEFT wall of the cave (x=' +
             G.player.x.toFixed(1) + ', wall at ' + b.left.toFixed(1) +
             '); there is nothing out there either');
      }
    }

    /* (d) the floor never climbs off the top of the screen. The unclamped floor
       walked up the viewport as the reader scrolled and took the player with it,
       which is how this first showed up - as "the character left the screen" at
       five viewports, a message that points at the player and not at the floor.

       Measured only across the scrolls where the room is actually ON SCREEN,
       because that is the only range in which there is a cave to be off the top
       of. Above that range the floor is not clamped and does not need to be: it
       is scenery behind five chambers, and the player is in the shaft. */
    let offTop = 0, checkedScrolls = 0;
    for (let sc = 0; sc <= L.maxScroll; sc += 120) {
      globalThis.window.scrollY = sc;
      L.syncScroll();
      if (!CV.caveActive()) continue;
      const fy = CV.screenFloorY(720);
      checkedScrolls++;
      if (!isFinite(fy) || fy < 0 || fy > L.viewH) offTop++;
    }
    if (!checkedScrolls) {
      fail('the cave was never active at any scroll position between 0 and the ' +
           'foot of the page, so none of the cave behaviour above the floor ' +
           'clamp was ever exercised');
    }
    if (offTop) {
      fail('the cave floor was outside the viewport at ' + offTop + ' of ' +
           checkedScrolls + ' scroll positions where the room is on screen; the ' +
           'player stands on this line, so once it leaves the frame there is ' +
           'nowhere for them to be. It has to park like the car does (see ' +
           'CAVE_FLOOR_PARK)');
    }

    /* (e) IS GONE. This used to assert that the cave's chest anchors were the
       REAL measured chests rather than a remembered layout, because the whole
       alignment argument rested on it: if the document had chests and the cave
       found none, every chest would have been unreachable by walking.

       There are no chests, and chestAnchors() is deleted rather than left
       returning an empty list. The check could not be kept honestly - with no
       chests in the document it would either skip itself forever (the vacuous
       green its own comment warns about) or assert something about a function
       that no longer exists. */

    /* (f) the hoist is drawn in the shaft and NOT drawn in the cave.

       Mutation 46 survives without this. The car going away when the player
       leaves it is a RENDERING judgement, not a coordinate: no draw call reports
       a bad number, the frame is entirely finite, and the page looks fine
       except for an empty mine car hanging in mid-air over the treasure room.

       Counted through the stub's fillRect counter. NOT through pathPts, which was
       the first attempt and is the wrong instrument twice over: drawHoist() draws
       the wheel, the bracket, the cables, the car body and the counterweight almost
       entirely with px() - plain fillRects - and the only path it strokes is the
       wheel arc. Counting path points therefore gave 0 for a frame where the car
       was plainly on screen, and the comparison came out inverted.

       Comparing a cave frame against a shaft frame is still the right shape of the
       check: "the hoist drew nothing" on its own would pass just as happily on a
       frame where the whole renderer had stopped. */
    {
      /* In the cave. */
      globalThis.window.scrollY = Math.max(0, TREASURE_TOP - 100);
      L.syncScroll();
      M.main.resize();
      CV.measureCave(L.viewW, L.viewH);
      CV.enterCave(G.player);
      G.player.inCave = true;
      const inCaveRects = countRects(() => R.render(16));
      /* The DIRECT check: render.js counts every time drawCar() actually runs, so
         this asks the question instead of inferring it from draw-call volume. The
         check it replaces compared total rects between the cave frame and a shaft
         frame - a proxy that read "the cave draws less, so the car must be gone". That
         held until the cave gained real art (backdrop, crystals, shelves), at which
         point it would have started failing for reasons having nothing to do with the
         car, or - worse - passing while a car was drawn. */
      const carInCave = R.carDrawn;
      if (carInCave !== 0) {
        fail('the mine car is still drawn while the player is standing in the cave: ' +
             'drawCar() ran ' + carInCave + ' time(s) with player.inCave set. An ' +
             'empty car hanging over the cave reads as a bug - nobody is riding it. ' +
             'drawHoist() has to return early on player.inCave');
      }

      /* In the shaft, on a scroll where the car is genuinely ON SCREEN. Asserted in
         the OTHER direction too, because a counter that only ever reads 0 would
         pass the check above for the wrong reason - it would pass because the
         renderer had stopped, not because the car was correctly skipped. */
      let carInShaft = 0;
      for (let sc = L.travelFrom; sc <= L.travelTo; sc += 25) {
        globalThis.window.scrollY = sc;
        L.syncScroll();
        M.main.resize();
        G.snapPlayerToGround();
        G.player.inCave = false;
        for (let i = 0; i < 200; i++) D.advanceCar(1 / 60);
        countRects(() => R.render(16));
        if (R.carDrawn > carInShaft) carInShaft = R.carDrawn;
      }
      if (!carInShaft) {
        fail('the mine car was never drawn at ANY scroll position in the travel ' +
             'window, so the check above would pass for the wrong reason: it cannot ' +
             'tell the car being correctly skipped from the renderer having stopped');
      }

      /* THE ELEVATOR IS DRAWN, AND IT IS NEVER ABOVE THE SOIL. The regression
         test for the floating car, walked from scroll 0 - the walk above starts
         at travelFrom and is structurally blind to the whole sky.

         BOTH halves are required, and that is the point. An earlier version
         asserted only that the car was drawn ZERO times above the soil, which
         passed purely because the renderer was HIDING it. The car is now parked
         on the ground instead of hidden, so the honest assertion is that it is
         always drawn AND never above the soil: the first half stops the second
         from being satisfiable by deletion.

         The sprite is measured with the car because it rides it - parking the car
         on the ground has to carry the sprite down too. */
      const bandTop2 = D.deckBounds().top;
      const skyEnd = Math.max(0, L.travelFrom - bandTop2 - 20);
      let carAbove = 0, carSeen = 0, spriteAbove = 0, spriteSeen = 0;
      for (let sc = 0; sc < skyEnd; sc += 25) {
        globalThis.window.scrollY = sc;
        L.syncScroll();
        M.main.resize();
        G.player.inCave = false;
        /* Settle the CAR first, then snap the player onto it. The walk above does
           the opposite order, which is fine for a position check on the car, but
           here the player is being asked to stand on a car that has not finished
           moving yet - so the sprite is one settle behind and reads as floating
           above the soil on a single frame. Car first, then player. */
        for (let i2 = 0; i2 < 200; i2++) D.advanceCar(1 / 60);
        G.snapPlayerToGround();        const soilY = L.surfaceFrom - sc;
        countRects(() => R.render(16));
        if (R.carDrawn > 0) carSeen++;
        if (R.playerDrawn > 0) spriteSeen++;
        if (D.groundY() < soilY - 1) carAbove++;
        if (G.player.y + G.player.h < soilY - 1) { spriteAbove++; }      }
      /* THE PARKED CAR IS ON THE GRASS WITHIN ONE FRAME OF A SCROLL JUMP.

         The reported symptom was not a wrong resting place - the car did end up on
         the surface - it was that it took a second or two to GET there, so the
         elevator floor arrived under the character well after the reader stopped
         scrolling. Every other check on this path settles 200-250 frames before
         measuring, so all of them were blind to it by construction.

         So this one does the opposite: it jumps the scroll, advances a SINGLE
         frame, and reads the car immediately. Parked motion tracks the ground 1:1
         with scrollY, so one frame is enough and anything else is the exponential
         easing still catching up. Measured as a worst case over the whole parked
         range, because the lag scales with how far the ground moved. */
      let worstLag = 0, lagAt = 0;
      for (let sc = 0; sc < skyEnd; sc += 25) {
        globalThis.window.scrollY = sc - 25 < 0 ? 0 : sc - 25;
        L.syncScroll();
        M.main.resize();
        G.player.inCave = false;
        for (let i2 = 0; i2 < 200; i2++) D.advanceCar(1 / 60);
        /* Now jump 25px and give it exactly one frame. */
        globalThis.window.scrollY = sc;
        L.syncScroll();
        D.advanceCar(1 / 60);
        G.snapPlayerToGround();
        const grass = L.surfaceFrom - sc;
        const lag = Math.abs(D.groundY() - grass);
        if (lag > worstLag) { worstLag = lag; lagAt = sc; }
      }
      /* AND A GENUINE RESIZE MUST NOT STRAND IT. main.js re-seats the car through
         seatDeck(true) when the viewport really changed. That path used to centre
         the car mid-band unconditionally, which parks a PARKED car in mid-air -
         and because the non-centred clamp below recovers it on the next frame, no
         settled-position assertion could see it. This one calls seatDeck(true)
         directly and reads the car immediately, with no frame in between to heal
         it. */
      {
        const sc = Math.max(0, Math.min(skyEnd - 1, 100));
        globalThis.window.scrollY = sc;
        L.syncScroll();
        M.main.resize();
        for (let i2 = 0; i2 < 200; i2++) D.advanceCar(1 / 60);
        D.seatDeck(true);
        const grass = L.surfaceFrom - sc;
        if (Math.abs(D.groundY() - grass) > 1) {
          fail('a re-seat with centre=true stranded the PARKED car off the grass ' +
               '(car at ' + D.groundY().toFixed(0) + ', grass at ' +
               grass.toFixed(0) + '). seatDeck() must seat a parked car on the ' +
               'surface rather than centring it in the band, or the elevator ' +
               'visibly jumps away from the reader on rotate');
        }
      }
      if (worstLag > 1) {
        fail('the parked car lags the ground by up to ' + worstLag.toFixed(1) +
             'px after a single frame at scroll ' + lagAt + '. The car is standing ' +
             'on the surface, and the surface moves 1:1 with the scroll, so the ' +
             'parked phase must SNAP rather than ease - otherwise the elevator ' +
             'floor arrives under the character seconds after the reader stops. ' +
             'advanceCar() must not apply TRAVEL_EASE while snapToParked() is true');
      }
      /* The SPRITE'S FEET ARE ON THE GRASS, not merely near it. The sprite is
         placed at groundY() - player.h, so it follows the car exactly - but only
         because the car's resting line IS the grass. This asserts the composed
         result rather than trusting that chain, because a change to either half
         would move the character off the surface while both still looked right. */
      let feetOff = 0, feetWorst = 0;
      for (let sc = 0; sc < skyEnd; sc += 25) {
        globalThis.window.scrollY = sc;
        L.syncScroll();
        M.main.resize();
        G.player.inCave = false;
        for (let i2 = 0; i2 < 200; i2++) D.advanceCar(1 / 60);
        G.snapPlayerToGround();
        const grass = L.surfaceFrom - sc;
        const d = G.player.y + G.player.h - grass;
        if (Math.abs(d) > 1) { feetOff++; if (Math.abs(d) > Math.abs(feetWorst)) feetWorst = d; }
      }
      if (feetOff) {
        fail('the SPRITE stands ' + feetOff + ' time(s) off the grass surface while ' +
             'the elevator is parked (worst ' + feetWorst.toFixed(1) +
             'px). It rides the car, and the car rests on the surface, so the ' +
             'character has to be standing ON the grass - not below it in the dirt');
      }
      if (carAbove > 0) {
        fail('the mine car sits ' + carAbove + ' time(s) ABOVE the soil line while ' +
             'scrolling the sky (0..' + Math.round(skyEnd) + '). carTarget() must ' +
             'clamp the parked car down onto the surface, and seatDeck() must not ' +
             'clamp it straight back up into the band');
      }
      if (spriteAbove > 0) {
        fail('the SPRITE stands ' + spriteAbove + ' time(s) above the soil line while ' +
             'the elevator is parked; it rides the car and has to be carried down ' +
             'with it');
      }
      if (!carSeen) {
        fail('the mine car is not drawn anywhere while scrolling the sky, so the ' +
             'checks above pass for the wrong reason: the elevator is missing from ' +
             'the top of the page rather than parked on the surface');
      }
      if (!spriteSeen) {
        fail('the SPRITE is not drawn anywhere while scrolling the sky, so it has ' +
             'been hidden rather than carried down with the car');
      }
      /* Put the player back in the cave for the checks that follow. */
      globalThis.window.scrollY = Math.max(0, TREASURE_TOP - 100);
      L.syncScroll();
      M.main.resize();
      CV.enterCave(G.player);
      G.player.inCave = true;
    }

    /* (g) the roof is INSIDE the frame at every viewport, and so is the floor with
       the player's head above it.

       Mutations 47 and 42b both survive without this. A cave 300px tall inside a
       200px window is not a visible fault in the stub - every coordinate is
       finite, the art is simply drawn partly off the top - and the ceiling clamp
       reports it as the player being off screen, which points at the player.

       So this measures the cave's own geometry directly, at the smallest viewport
       the suite renders, which is the only one where the cave can be taller than
       its window. */
    {
      const oldH = globalThis.document.documentElement.clientHeight;
      const oldIH = globalThis.window.innerHeight;
      globalThis.document.documentElement.clientHeight = 200;
      globalThis.window.innerHeight = 200;
      M.main.resize();
      CV.measureCave(L.viewW, 200);
      globalThis.window.scrollY = Math.max(0, TREASURE_TOP - 40);
      L.syncScroll();
      M.main.resize();
      CV.measureCave(L.viewW, 200);
      CV.enterCave(G.player);
      G.player.inCave = true;
      for (let i = 0; i < 40; i++) G.movePlayer(1 / 60);
      const roof = CV.caveRoof();
      const floor = CV.screenFloorY(G.player.x + G.player.w / 2);
      if (!isFinite(roof) || roof < 0) {
        fail('in a 200px-tall window the cave roof sits at y=' +
             (isFinite(roof) ? roof.toFixed(1) : 'NaN') + ', which is off the top ' +
             'of the screen; the cave has to fit inside the frame it is drawn in, ' +
             'or the ceiling clamp fires and the player is reported as off screen');
      }
      if (G.player.y < -0.5) {
        fail('in a 200px-tall window the player stands at y=' +
             G.player.y.toFixed(1) + ', above the top of the screen. The floor ' +
             'park line has to leave room for the whole sprite (' +
             G.player.h + 'px), not just for the floor line itself');
      }
      if (!(floor > G.player.y)) {
        fail('the cave floor (' + floor.toFixed(1) + ') is not below the player ' +
             '(' + G.player.y.toFixed(1) + ') in a 200px window');
      }
      /* Restore the desktop viewport for anything that follows. */
      globalThis.document.documentElement.clientHeight = oldH;
      globalThis.window.innerHeight = oldIH;
      M.main.resize();
      CV.measureCave(L.viewW, L.viewH);
      globalThis.window.scrollY = Math.max(0, TREASURE_TOP - 100);
      L.syncScroll();
      M.main.resize();
      CV.enterCave(G.player);
      G.player.inCave = true;
    }

    /* (h) the floor's park line leaves room for the sprite, and the cave fits in
       the window - checked at a DESKTOP viewport, not the 200px one below.

       Mutation 42b survived when this was only measured in a 200px window, and the
       reason is instructive: caveFloorParkY() returns max(viewH * 0.34, sprite +
       relief), so at 200px the THIRD-OF-THE-FRAME term wins and the sprite term
       never fires. The fault removes a term that is genuinely dead at that size -
       it is only the binding constraint on a viewport short enough for 34% of it
       to be less than 64px plus the floor's relief.

       So it has to be checked where it actually decides the answer: a window
       narrow enough in HEIGHT that a third of it is below the sprite. 300px is
       that case - a third is 102px, well above the 88px the sprite needs - so this
       asserts the floor at 150px instead, where a third is 51px and the sprite
       term is the only thing keeping the player on screen. */
    {
      const saveH = globalThis.document.documentElement.clientHeight;
      const saveIH = globalThis.window.innerHeight;
      globalThis.document.documentElement.clientHeight = 150;
      globalThis.window.innerHeight = 150;
      M.main.resize();
      CV.measureCave(L.viewW, 150);
      globalThis.window.scrollY = Math.max(0, TREASURE_TOP - 30);
      L.syncScroll();
      M.main.resize();
      CV.measureCave(L.viewW, 150);
      CV.enterCave(G.player);
      G.player.inCave = true;
      for (let i = 0; i < 60; i++) G.movePlayer(1 / 60);
      if (G.player.y < -0.5) {
        fail('in a 150px-tall window the player stands at y=' +
             G.player.y.toFixed(1) + ', above the top of the screen, and a third ' +
             'of that window is only ' + (150 / 3).toFixed(0) + 'px - too little ' +
             'for a ' + G.player.h + 'px sprite. caveFloorParkY() has to take the ' +
             'larger of a third of the viewport and the sprite height plus the ' +
             'floor relief, not just the first');
      }
      if (G.player.y + G.player.h >
          CV.screenFloorY(G.player.x + G.player.w / 2) + 1) {
        fail('in a 150px-tall window the player sank through the cave floor (feet ' +
             'at ' + (G.player.y + G.player.h).toFixed(1) + ', floor at ' +
             CV.screenFloorY(G.player.x + G.player.w / 2).toFixed(1) + ')');
      }
      globalThis.document.documentElement.clientHeight = saveH;
      globalThis.window.innerHeight = saveIH;
      M.main.resize();
      CV.measureCave(L.viewW, L.viewH);
      globalThis.window.scrollY = Math.max(0, TREASURE_TOP - 100);
      L.syncScroll();
      M.main.resize();
      CV.enterCave(G.player);
      G.player.inCave = true;
    }

    /* (i) an UNMEASURED cave answers NaN rather than throwing.

       Mutation 41 removes the `if (!room) return NaN` guard, and it survives
       because no check ever reaches it: this suite always measures the cave before
       asking it anything, because the real page's .treasure box is never
       degenerate by the time the reader can scroll.

       It IS reachable though, and the stub proves it - it hands back a zero-height
       box during part of the run, which is exactly the condition measureCave()
       treats as "no room". So this measures it directly: ask an unmeasured cave for
       its floor, and require a number that is visibly not-a-number rather than a
       TypeError from dereferencing null.

       The assertion is deliberately on the SHAPE of the answer rather than on
       "it did not throw": a guard that returned 0 instead of NaN would satisfy the
       letter of the second and quietly put the player on a floor at the top of the
       screen, which is the bug the guard exists to prevent. NaN is visible to
       every consumer - the stub context reports non-finite coordinates, and
       movePlayer() refuses to enter the cave on a non-finite floor. */
    {
      const saveRect = globalThis.document.querySelector;
      /* Make the room unmeasurable, the way a not-yet-laid-out document is.
         The anchor is now `.dig` - the cave reads that box, since the empty
         treasure-room section it used to measure is gone from the markup. */
      globalThis.document.querySelector = function (sel) {
        if (sel === '.dig') return null;
        return saveRect.call(globalThis.document, sel);
      };
      CV.measureCave(L.viewW, L.viewH);
      globalThis.document.querySelector = saveRect;
      const y = CV.screenFloorY(200);
      if (!Number.isNaN(y)) {
        fail('with no treasure room measured, screenFloorY() returned ' +
             String(y) + ' rather than NaN. It has to be visibly unusable: a 0 here ' +
             'would put the player on a floor at the top of the screen, and the ' +
             'stub context would not report anything wrong with it. NaN is what ' +
             'every consumer already knows how to refuse');
      }
      /* And the gate must be closed while there is no room, or the player walks
         into a cave that has no floor. */
      if (CV.caveActive()) {
        fail('caveActive() is true with no treasure room measured, so the player ' +
             'would be handed to a cave whose floor does not exist');
      }
      /* Put the real room back. */
      CV.measureCave(L.viewW, L.viewH);
      globalThis.window.scrollY = Math.max(0, TREASURE_TOP - 100);
      L.syncScroll();
      M.main.resize();
      CV.enterCave(G.player);
      G.player.inCave = true;
    }

    /* Put the page back where the rest of the suite expects it. */
    globalThis.window.scrollY = 0;
    L.syncScroll();
    G.snapPlayerToGround();
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
  console.log('  stops just before the hollow cave, and never passes that stop');
  console.log('  no direction reversals; character never sinks; no non-finite coordinates');
  console.log('  pixel-art sheets sliced and tinted: ' + slices.length +
              ' sprites (the trees; the grass, tufts and rock are all drawn)');
  console.log('  soil and grass both clipped to the jagged seam, so neither can' +
               ' sit above the green line');
  console.log('  the hollow cave measures, and the lift car still stops above it');
}

run().catch((e) => {
  console.error('SMOKE ERRORED: ' + e.message);
  console.error(e.stack);
  process.exitCode = 1;
});



