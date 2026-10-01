/* ==========================================================================
   treasure.js - opening the chests in the Bedrock treasure room
   ==========================================================================
   The hoard: five chests, each of which opens to reveal a short piece of the
   resume and adds its gold to a running tally. Opening everything lights the
   room.

   This module is a LEAF: it imports nothing and exports one function. That is
   what keeps the graph acyclic, since it sits under main.js but beside
   layers.js rather than in the middle of the layers <- game <- render chain.

   The design rule it obeys: every piece of text a chest reveals is already in
   index.html. This file only moves a class, sets an attribute and writes a
   number into a span that is already in the document. It builds no markup -
   textContent and setAttribute only, never innerHTML - so there is no path by
   which a value read out of the DOM can become markup.

   The gold is read from data-gold on each button rather than hard-coded here,
   which means re-weighting the hoard is an edit to the HTML and nothing else.
   ========================================================================== */

/* The room carries --gold from 0 to 1 as the hoard fills, and treasure.css
   spends it on the room's own surface (a brighter treasure light). Writing it
   as a custom property rather than toggling a class is what lets the glow
   change CONTINUOUSLY with the count, so a half-empty hoard looks half-lit. */
function paintRoom(room, found, total) {
  room.style.setProperty('--gold', total > 0 ? (found / total).toFixed(3) : '0');
}

/* Wire the hoard. Called once from main.js at boot.
   Returns the tally so a caller (or the smoke check) can assert on it without
   reaching back into the DOM. */
function initHoard() {
  var room = document.getElementById('contact');
  var grid = document.getElementById('vault-grid');
  var countEl = document.getElementById('gold-count');
  var totalEl = document.getElementById('gold-total');
  if (!room || !grid || !countEl || !totalEl) {
    /* No hoard in this document. Returning quietly is what lets the module be
       imported unconditionally rather than guarded at every call site. */
    return { found: 0, total: 0 };
  }

  var chests = grid.querySelectorAll('.chest');
  var found = 0, total = 0, i;

  /* Total first, so the "0 of 9 gold" line is honest from the first paint
     rather than waiting for a click. A chest whose data-gold is missing or
     unparseable counts as zero: it still opens, it just has no gold in it,
     which is better than the whole tally becoming NaN. */
  for (i = 0; i < chests.length; i++) {
    var g = parseInt(chests[i].dataset.gold, 10);
    if (isFinite(g) && g > 0) total += g;
  }
  totalEl.textContent = String(total);
  /* The found count is written here too, not just on click. The markup ships a
     literal 0 in the span, which is what a no-JS reader sees - but this module
     owns the number once it runs, and leaving the initial value to the markup
     means the two can disagree if a chest is ever removed. Writing both halves
     in one place is what keeps "0 of 9" assembled from a single source. */
  countEl.textContent = String(found);

  function open(chest) {
    var loot = document.getElementById(chest.getAttribute('aria-controls'));
    var isOpen = chest.getAttribute('aria-expanded') === 'true';

    if (isOpen) {
      chest.setAttribute('aria-expanded', 'false');
      chest.dataset.spent = '0';
      if (loot) loot.setAttribute('aria-hidden', 'true');
      var back = parseInt(chest.dataset.gold, 10);
      found -= (isFinite(back) && back > 0) ? back : 0;
    } else {
      chest.setAttribute('aria-expanded', 'true');
      /* data-spent is separate from aria-expanded on purpose: one is a fact for
         assistive tech, the other is a visual memory of what you already took.
         Folding them together would mean the chest could not be re-closed. */
      chest.dataset.spent = '1';
      if (loot) loot.setAttribute('aria-hidden', 'false');
      var worth = parseInt(chest.dataset.gold, 10);
      found += (isFinite(worth) && worth > 0) ? worth : 0;
    }

    countEl.textContent = String(found);
    paintRoom(room, found, total);
  }

  for (i = 0; i < chests.length; i++) {
    (function (chest) {
      /* The loot starts visually collapsed by CSS (`.js .chest__loot` in
         treasure.css). aria-hidden has to be set here to MATCH that, because a
         collapsed-but-not-hidden panel is content a screen reader still reads -
         so the visual state and the announced state would disagree until the
         first click. This is the no-JS safety net inverted: with no script the
         panel is open AND unhidden, which is the honest description of it. */
      var panel = document.getElementById(chest.getAttribute('aria-controls'));
      if (panel) panel.setAttribute('aria-hidden', 'true');

      chest.addEventListener('click', function () { open(chest); });
      /* Space and Enter are what a <button> already does natively. There is no
         keydown handler here on purpose: adding one would risk double-firing,
         since Enter on a button synthesises a click in most engines. */
    })(chests[i]);
  }

  paintRoom(room, found, total);
  return { found: found, total: total };
}

/* Public surface of this module. Collected at the bottom to match every other
   module in this project, so the graph check in tools/smoke.mjs can read it. */
export { initHoard };