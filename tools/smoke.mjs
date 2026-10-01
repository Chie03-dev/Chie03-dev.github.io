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
    save: noop, restore: noop, closePath: noop, rect: noop, fill: noop,
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
  /* The rooms the travel window is anchored to, keyed by the exact selectors
     layers.js measure() uses. The treasure room is also data-layer="bedrock",
     so selecting it by class is what distinguishes it from the Education
     chamber - and the car is specified to stop BEFORE it. */
  '[data-layer="dirt"]': box(634, 200, 872, 520),
  '.treasure': box(3170, 600, 48, 1344)
};
/* The document Y of the treasure room, taken from the stub itself rather than
   repeated as a literal, so the barrier assertion below cannot drift away from
   the geometry that actually drives it. Read through the stub's own docTop
   closure value, NOT via getBoundingClientRect() - that subtracts the current
   scroll, and `window` does not exist yet at this point in the file. */
const TREASURE_TOP = 3170;
/* A fake chest, and the fake loot panel it controls. Enough of a real element for
   treasure.js: dataset, the aria attributes, style.setProperty, textContent and
   a click listener that can be fired by the test.

   This exists rather than having the harness return an empty list, because an
   empty list would make initHoard() take its "no hoard in this document" early
   return and the whole module would go untested while still reporting a pass -
   the same species of vacuous green the band assertions had before the fixture
   was given realistic gaps. */
function fakeLoot(id) {
  return {
    id: id, attrs: {}, textContent: '',
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }
  };
}
function fakeChest(gold, n) {
  /* The loot id MUST be unique per chest. It was derived from the gold value
     alone at first, and the two 2-gold chests then shared one id - so a click on
     one toggled aria-hidden on the other's panel, and the assertion fired on
     correct code. The same duplicate-id bug in the real markup would mean two
     chests controlling one panel. */
  const loot = fakeLoot('loot-' + n);
  const self = {
    dataset: { gold: String(gold), spent: '0' },
    attrs: { 'aria-expanded': 'false', 'aria-controls': loot.id },
    style: { props: {}, setProperty(k, v) { this.props[k] = v; } },
    textContent: '', loot: loot, fired: 0,
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; },
    addEventListener(_type, fn) { this._fn = fn; },
    /* Drive it the way a reader would. */
    click() { this.fired++; if (this._fn) this._fn(); }
  };
  return self;
}
const FAKE_CHESTS = [3, 2, 1, 2, 1].map((g, i) => fakeChest(g, i));
const FAKE_TOTAL = FAKE_CHESTS.reduce((n, c) => n + parseInt(c.dataset.gold, 10), 0);

const stubEl = (sel) => known[sel] || {
  classList: { add: noop, remove: noop, contains: () => false },
  style: { props: {}, setProperty: noop }, dataset: {}, textContent: '',
  addEventListener: noop,
  querySelector: () => null,
  querySelectorAll: () => [],
  getBoundingClientRect: () => box(0, 0, 0, 0)
};
/* The hoard, keyed by the exact ids treasure.js asks for - which have NO leading
   '#'. They used to, which meant getElementById() missed every one of them,
   initHoard() took its early return, and all seven hoard assertions failed
   while the module itself reported a clean zero. The keys have to match the
   lookups exactly or the fixture tests nothing. */
known['vault-grid'] = { querySelectorAll: () => FAKE_CHESTS };
known['gold-count'] = { textContent: '' };
known['gold-total'] = { textContent: '' };
/* The room itself, because treasure.js writes --gold onto it and the assertion
   reads it back. Without this the generic stub's no-op setProperty swallowed
   every write and the check reported --gold=undefined on correct code. */
known['contact'] = {
  style: { props: {}, setProperty(k, v) { this.props[k] = v; } }
};
/* The loot panels, one per fake chest, addressed by the aria-controls the fake
   buttons carry. */
for (const c of FAKE_CHESTS) known[c.loot.id] = c.loot;

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
    if (ls.length !== 5) fail('expected 5 layers, measured ' + ls.length);
    for (let i = 0; i < ls.length; i++) {
      const l = ls[i];
      if (!(l.height > 0)) fail(l.id + ' band has no height');
      /* panelTop/panelBottom are what the band is derived FROM, so comparing
         against them tests the derivation itself rather than a re-measure. */
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

      /* Three times, spread over a window long enough for a cloud to drift in
         and back out of a gutter. The bug reproduced well inside this. */
      const frames = [0, 700, 1900, 4300].map(snap);
      const base = frames[0];
      if (!base.length) {
        fail('no tree was placed with the soil line on screen; the props pass ' +
             'placed nothing (propsDrawn=' + R.propsDrawn + ')');
      }
      /* DENSITY, and this is the check that catches the bare-meadow bug.

         A tree that is placed is not a meadow. The two sheet crops are 83x96
         and 62x72 while the desktop gutter is 48px wide, so drawing them at
         scaleFor()'s integer scale (1 or 2) puts one tree PER GUTTER - two on
         the whole page - and every other assertion in this file still passes:
         the sprites are valid, in a gutter, standing on the ground, drawn once
         each, and identical between frames. The only thing that distinguishes
         "a meadow" from "two lonely trees" is HOW MANY.

         The floor is deliberately loose. It is a regression guard, not a taste
         check: 8 is well under the ~15 this now places at 1440, and 2 - the
         broken behaviour - is under it. */
      if (base.length < 8) {
        fail('only ' + base.length + ' trees were placed at 1440x900; the ' +
             'surface is meant to be a meadow, not two lonely trees. A tree ' +
             'wider than its gutter fits exactly one per gutter, so check the ' +
             'target width passed to blitOn() (TREE_W) rather than the crown gap');
      }
      /* Every tree must FIT the gutter it was planted in. An 83px crop in a
         48px gutter overhangs the opaque panel it stands beside, which is the
         same bug wearing a different hat: the tree is drawn, just not where it
         can be seen. Recorded dw is the drawn width.

         The gutter width is READ from the module rather than hard-coded. A
         literal 48 here would be a second source of truth that quietly stops
         being true the moment a breakpoint or a rail width changes - and a test
         that asserts a stale number is worse than no test, because it looks
         like it is protecting something. */
      const gu = M.biomes.gutters(L.layers[0]);
      const widest = gu.length ? Math.max.apply(null, gu.map((x) => x.w)) : 0;
      /* The NARROWEST gutter is the one that constrains a tree, and the big
         outboard strip on a wide screen is not what limits the count. */
      const narrowest = gu.length ? Math.min.apply(null, gu.map((x) => x.w)) : 0;
      const over = base.map((s) => Number(s.split(',')[2]))
                      .filter((w) => w > narrowest + 1);
      if (over.length) {
        fail(over.length + ' tree(s) are drawn wider than the narrowest gutter ' +
             '(' + Math.round(narrowest) + 'px; widest ' + Math.round(widest) +
             'px) they stand in, so they overhang the panel and are half hidden');
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
  console.log('  pixel-art sheets sliced and tinted: ' + slices.length +
              ' sprites (the trees; the grass, tufts and rock are all drawn)');
  console.log('  soil and grass both clipped to the jagged seam, so neither can' +
               ' sit above the green line');
  console.log('  the hoard loads and boots without error (its own behaviour,');
  console.log('    markup and CSS are asserted by tools/hoard-test.mjs)');
}

run().catch((e) => {
  console.error('SMOKE ERRORED: ' + e.message);
  console.error(e.stack);
  process.exitCode = 1;
});


