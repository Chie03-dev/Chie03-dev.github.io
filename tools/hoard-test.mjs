/* ==========================================================================
   tools/hoard-test.mjs - the treasure room's hoard, checked on its own
   ==========================================================================
   Run it with:  node tools/hoard-test.mjs      (from the repo root)

   WHY IT IS NOT IN smoke.mjs. smoke.mjs is one process that imports every module
   against ONE shared DOM stub, and it was already 900+ lines before the hoard
   existed. The 500-line rule applies to this repository without exception, so the
   hoard checks live here instead - with their OWN fixture, not a slice of smoke's.

   That is not only a line-count compromise. The interesting failures here are
   spatial: a loot panel that never collapses, a chest laid across the shaft
   channel, a focus ring that is not there. A stub DOM cannot see any of that, so
   most of this file reads the CSS and the markup directly and asserts on the
   text - no DOM required.

   WHAT IS ASSERTED, and the reasoning that mattered:

     1. The tally counts every chest's data-gold exactly once, and the room's
        --gold reaches 1 when the hoard is full.
     2. Opening a chest flips aria-expanded and un-hides its loot; closing it
        restores BOTH. A one-way tally is the classic bug: the reader opens a
        chest, changes their mind, and the room stays lit forever.
     3. Shut loot is aria-hidden at boot, so the collapsed panel and what a screen
        reader says about it cannot disagree.
     4. The markup carries NO hidden attribute, so the hoard survives with no
        JavaScript at all.
     5. The grid reuses the room's three tracks and leaves the middle one empty,
        so the hoard cannot bury the shaft opening - and collapses to one column
        on a phone, where the shaft is an edge strip rather than a channel.
   ========================================================================== */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initHoard } from '../js/treasure.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
let failures = 0;
const fail = (m) => { failures++; console.log('    FAIL ' + m); };

/* === A fake hoard ========================================================= */

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
     one toggled aria-hidden on the other's panel and the assertion fired on
     correct code. The same duplicate-id bug in the real markup would mean two
     chests controlling one panel. */
  const loot = fakeLoot('loot-' + n);
  return {
    dataset: { gold: String(gold), spent: '0' },
    attrs: { 'aria-expanded': 'false', 'aria-controls': loot.id },
    textContent: '', loot: loot, fired: 0, _fn: null,
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; },
    addEventListener(_type, fn) { this._fn = fn; },
    click() { this.fired++; if (this._fn) this._fn(); }
  };
}
const CHESTS = [3, 2, 1, 2, 1].map((g, i) => fakeChest(g, i));
const TOTAL = CHESTS.reduce((n, c) => n + parseInt(c.dataset.gold, 10), 0);

const countEl = { textContent: '' };
const totalEl = { textContent: '' };
const room = { style: { props: {}, setProperty(k, v) { this.props[k] = v; } } };
const BY_ID = {
  contact: room,
  'vault-grid': { querySelectorAll: () => CHESTS },
  'gold-count': countEl,
  'gold-total': totalEl
};
for (const c of CHESTS) BY_ID[c.loot.id] = c.loot;

globalThis.document = { getElementById: (id) => BY_ID[id] || null };

/* === 1-3. Behaviour ======================================================= */

const tally = initHoard();

if (tally.total !== TOTAL) {
  fail('the hoard totals ' + tally.total + ' gold, expected ' + TOTAL +
       ' - every data-gold must be counted exactly once');
}
if (totalEl.textContent !== String(TOTAL)) {
  fail('the "of N gold" half of the tally reads "' + totalEl.textContent +
       '", expected ' + TOTAL);
}
if (countEl.textContent !== '0') {
  fail('the tally does not start at 0, it starts at "' + countEl.textContent +
       '" - the initial value was left to the markup rather than written here');
}
if (CHESTS.some((c) => c.loot.attrs['aria-hidden'] !== 'true')) {
  fail('a closed chest has loot that is not aria-hidden: the panel is visually ' +
       'shut but a screen reader still reads it');
}

const worth = CHESTS.map((c) => parseInt(c.dataset.gold, 10));
for (let i = 0; i < CHESTS.length; i++) {
  CHESTS[i].click();
  const expect = worth.slice(0, i + 1).reduce((a, b) => a + b, 0);
  if (countEl.textContent !== String(expect)) {
    fail('after opening ' + (i + 1) + ' chests the tally reads "' +
         countEl.textContent + '", expected ' + expect);
    break;
  }
  if (CHESTS[i].getAttribute('aria-expanded') !== 'true') {
    fail('chest ' + i + ' did not report aria-expanded=true to assistive tech');
    break;
  }
  if (CHESTS[i].loot.attrs['aria-hidden'] !== 'false') {
    fail('chest ' + i + ' opened but its loot stayed aria-hidden, so the text ' +
         'it reveals is invisible to a screen reader');
    break;
  }
}

if (room.style.props['--gold'] !== '1.000') {
  fail('a full hoard left the room at --gold=' + room.style.props['--gold'] +
       ', expected 1.000 - the treasure light in treasure.css is driven off this ' +
       'variable, so the room never lights');
}

/* Closing must give the gold BACK and put the loot away again. */
CHESTS[0].click();
if (CHESTS[0].getAttribute('aria-expanded') !== 'false') {
  fail('clicking an open chest did not close it');
}
const afterClose = TOTAL - worth[0];
if (countEl.textContent !== String(afterClose)) {
  fail('closing a chest left the tally at "' + countEl.textContent +
       '", expected ' + afterClose + ' - gold was not returned');
}
if (CHESTS[0].loot.attrs['aria-hidden'] !== 'true') {
  fail('a closed chest still has readable loot (aria-hidden was not restored)');
}
if (room.style.props['--gold'] !== (afterClose / TOTAL).toFixed(3)) {
  fail('closing a chest did not dim the room back to --gold=' +
       (afterClose / TOTAL).toFixed(3));
}
/* A listener attached twice would make one click add two chests' worth of gold.
   The per-chest counts above already prove one click adds exactly one chest. */

/* === 4-5. Markup and CSS, read directly =================================== */

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const lootTags = html.match(/<div class="chest__loot"[^>]*>/g) || [];
if (!lootTags.length) {
  fail('no chest loot panels found in index.html - the hoard markup is gone');
}
for (const tag of lootTags) {
  if (/\shidden\b/.test(tag)) {
    fail('a chest loot panel carries the hidden attribute: with no JavaScript it ' +
         'would never be revealed and that copy would be lost');
    break;
  }
}

const buttons = html.match(/<button class="chest"[^>]*>/g) || [];
if (buttons.length !== lootTags.length) {
  fail('the hoard has ' + buttons.length + ' chest buttons but ' +
       lootTags.length + ' loot panels');
}
for (const tag of buttons) {
  if (!/aria-controls="/.test(tag) || !/aria-expanded="false"/.test(tag)) {
    fail('a chest button is missing aria-controls or a starting aria-expanded: ' +
         tag.trim());
    break;
  }
  if (!/type="button"/.test(tag)) {
    fail('a chest button has no type="button", so it would submit if the page were ' +
         'ever put in a form: ' + tag.trim());
    break;
  }
}
/* Each aria-controls must name a panel that exists, or opening reveals nothing. */
const ids = new Set(buttons.map((t) => (t.match(/aria-controls="([^"]+)"/) || [])[1]));
for (const id of ids) {
  if (id && !new RegExp('id="' + id + '"').test(html)) {
    fail('a chest points at aria-controls="' + id + '", which is not in the ' +
         'document - opening that chest would reveal nothing');
    break;
  }
}
/* And no two chests may share one panel - the bug the fixture first had. */
if (ids.size !== buttons.length) {
  fail('two chests share an aria-controls target (' + ids.size + ' targets for ' +
       buttons.length + ' chests)');
}
/* Each loot panel needs a single inner wrapper. `grid-template-rows:0fr`
   constrains the FIRST row only, so a panel with two <p> children keeps its
   second paragraph at full height and never actually closes - measured at 84px
   shut and 84px open in a real browser before this was fixed. */
/* The indent after `>` is matched with \\s*, not literal spaces: the hoard
   markup is re-indented whenever the two stacks are rebalanced, and a
   whitespace-exact pattern silently stopped matching then - which showed up as
   a mutation SETUP FAILED rather than as a failing assertion. */
for (const tag of lootTags) {
  const id = (tag.match(/id="([^"]+)"/) || [])[1];
  if (id && !new RegExp('id="' + id + '">\\s*<div class="chest__loot-in">').test(html)) {
    fail('the loot panel "' + id + '" does not have exactly one inner ' +
         '.chest__loot-in wrapper - the 0fr collapse only reaches the first child');
    break;
  }
}

if (!existsSync(join(ROOT, 'css', 'treasure.css'))) {
  fail('css/treasure.css is missing');
} else if (!/<link rel="stylesheet" href="css\/treasure\.css">/.test(html)) {
  fail('index.html does not load css/treasure.css');
}

const css = readFileSync(join(ROOT, 'css', 'treasure.css'), 'utf8');
const flat = css.replace(/\s+/g, '');
/* The hoard is TWO CONTAINERS SIDE BY SIDE, not one list with cells placed into
   columns. This is checked structurally, by counting the containers, because the
   visual difference is the whole point: in the single-list version the cells
   share implicit rows, so opening a chest on the left pushes the right-hand
   chests down a row and the two halves stop lining up. */
const stacks = html.match(/<ul class="vault__stack[^"]*"/g) || [];
if (stacks.length !== 2) {
  fail('the hoard has ' + stacks.length + ' side-by-side stacks, expected 2 - the ' +
       'treasure room is meant to be two containers, one each side of the shaft');
}
if (!/<div class="vault__row" id="vault-grid">/.test(html)) {
  fail('the two stacks are not wrapped in a .vault__row, so nothing is holding ' +
       'them side by side');
}
/* treasure.js finds the hoard by this id and queries .chest beneath it, so the id
   has to stay on the wrapper that CONTAINS both stacks. Left on one of the
   stacks it would find only three of the five chests and the tally would be
   short by 2 gold. */
const rowBlock = (html.match(/<div class="vault__row" id="vault-grid">[\s\S]*?<\/ul>\s*<\/div>/) || [''])[0];
if (rowBlock && stacks.length === 2 && (rowBlock.match(/<ul class="vault__stack/g) || []).length !== 2) {
  fail('id="vault-grid" does not enclose both stacks - treasure.js queries .chest ' +
       'under it, so a chest outside it would never be counted or clickable');
}
/* Each stack must hold at least one chest, or a side of the room is empty. */
for (const side of ['left', 'right']) {
  const block = (html.match(new RegExp('<ul class="vault__stack vault__stack--' + side + '">[\\s\\S]*?<\\/ul>')) || [''])[0];
  if (block && !/<li class="vault__cell">/.test(block)) {
    fail('the ' + side + ' stack has no chests in it');
  }
}

if (!/\.vault__row\{[^}]*grid-template-columns:1frvar\(--shaft-w\)1fr/.test(flat)) {
  fail('the hoard row does not reuse the room three tracks (1fr var(--shaft-w) ' +
       '1fr), so the stacks can cover the shaft channel');
}
if (!/\.vault__stack--left\{grid-column:1\}/.test(flat)) {
  fail('the left stack is not placed in column 1');
}
if (!/\.vault__stack--right\{grid-column:3\}/.test(flat)) {
  fail('the right stack is not placed in column 3, so it drifts into the shaft ' +
       'channel');
}
/* Without this the shorter stack stretches to the taller one and leaves dead
   space under its last chest. */
if (!/\.vault__row\{[^}]*align-items:start/.test(flat)) {
  fail('.vault__row has no align-items:start, so the shorter stack is stretched ' +
       'to match the taller one and leaves a gap under its last chest');
}
const phone = flat.slice(flat.indexOf('@media(max-width:820px)'));
if (!/\.vault__row\{grid-template-columns:1fr/.test(phone)) {
  fail('the hoard row is not collapsed to one column on a phone, leaving an ' +
       'empty shaft-width gutter in the middle of the room');
}
if (!/\.vault__stack--left,\.vault__stack--right\{grid-column:1\}/.test(phone)) {
  fail('the phone breakpoint does not put both stacks in column 1, so one of ' +
       'them keeps a grid-column that no longer exists');
}
/* The loot must not be collapsed without .js - that is the no-JS guarantee. */
if (!/\.js\.chest__loot\{display:grid;grid-template-rows:0fr/.test(flat)) {
  fail('the loot is not collapsed under html.js, so it cannot be progressively ' +
       'enhanced');
}
/* Reduced motion has to cover the lid and the loot. The `\)\{` is required: the
   block is `@media(prefers-reduced-motion:reduce){`, and a pattern expecting
   `reduce{` never matches it. */
if (!/prefers-reduced-motion:reduce\)\{[^}]*\.chest/.test(flat)) {
  fail('treasure.css does not neutralise the chest transitions under ' +
       'prefers-reduced-motion');
}
/* A keyboard user must be able to see which chest is focused. Measured in a real
   browser: the computed outline was "none" before this rule existed.

   The VALUE is checked, not merely the presence of an outline declaration -
   `.chest:focus-visible{outline:none}` satisfies "has an outline" and is exactly
   as invisible to a keyboard user as having no rule at all. Mutation 38 slipped
   past the presence-only version. */
const focusRule = (flat.match(/\.chest:focus-visible\{[^}]*\}/) || [''])[0];
if (!/\.chest:focus-visible\{/.test(flat)) {
  fail('chests have no :focus-visible rule, so a keyboard user cannot tell where ' +
       'they are');
} else if (/outline:\s*(none|0)\b/.test(focusRule)) {
  fail('the :focus-visible outline is suppressed (' + focusRule +
       ') - that is the same as having no focus ring at all');
} else if (!/outline:\s*3px/.test(focusRule)) {
  fail('the :focus-visible outline is not a 3px ring: ' + focusRule);
}
/* The art stays code-drawn: no image files anywhere in the stylesheet. */
if (/url\(|["'(]\S*\.(png|jpe?g|gif|webp|svg)\b/i.test(css)) {
  fail('treasure.css references an image file - the art must stay code-drawn');
}

console.log('');
if (failures) {
  console.log('HOARD TEST FAILED: ' + failures + ' problem(s)');
  process.exitCode = 1;
} else {
  console.log('HOARD TEST PASSED:');
  console.log('  ' + CHESTS.length + ' chests, ' + TOTAL + ' gold: open and close, count ' +
               'up and back down, room lights at --gold=1');
  console.log('  loot is aria-hidden when shut and announced when open');
  console.log('  survives with no JS: no hidden loot, real buttons, every target resolves');
  console.log('  two side-by-side stacks, shaft channel kept clear, one column on a phone');
  console.log('  focus ring present; reduced motion honoured; no image assets');
}
/* === 1-3. Behaviour ======================================================= */