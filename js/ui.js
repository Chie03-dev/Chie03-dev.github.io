/* ==========================================================================
   ui.js - the DOM side: reveals, depth rail, plain resume
   ==========================================================================
   The IntersectionObserver panel reveals, the depth rail active marker, and the
   plain-resume disclosure with its print hook. All resume text stays in
   index.html as real HTML; this only wires behaviour to it. textContent and
   createElement only, never innerHTML.
   ========================================================================== */

import {
  layers, activeLayerIndex, metresPerPx
} from './layers.js';

/* === 8. Panel reveals ====================================================
   IntersectionObserver adds .is-visible, which is what the CSS transitions
   on. No scroll maths involved, and the observer is dropped after the first
   reveal so there is no ongoing cost once a panel has been seen. */
if ('IntersectionObserver' in window) {
  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        entries[i].target.classList.add('is-visible');
        io.unobserve(entries[i].target);
      }
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -10% 0px' });

  /* `.treasure` is out of this selector too. It was the treasure room, and the
   room is gone from the markup - only `.chamber` elements remain, so observing a
   class that matches nothing would have made the query look like it still had a
   sixth panel to reveal. */
  var panels = document.querySelectorAll('.chamber');
  for (var p = 0; p < panels.length; p++) io.observe(panels[p]);
} else {
  /* No observer support: show everything rather than hide content. */
  var fallback = document.querySelectorAll('.chamber');
  for (var f = 0; f < fallback.length; f++) fallback[f].classList.add('is-visible');
}
/* === Depth meter =========================================================
   The active layer comes from activeLayerIndex(), which is scroll
   bookkeeping, not panel reveal: panels still use IntersectionObserver.
   Writes are gated on an actual change so the DOM is not touched 60x a
   second while scrolling.

   This is also what lights the doorways. The sprite is walled into the
   shaft and its car travels inside whichever layer is active, so "the row
   the sprite is on" is exactly the row activeLayerIndex() names - the same
   index that highlights a depth-rail entry. Reusing one function for the
   rail, the doorway and the shaft's material is what stops the lit door and
   the active rail entry from drifting apart, and it costs one classList call
   per row on change rather than a second scroll handler. */
var depthLinks = document.querySelectorAll('.depth__list a');
var activeIndex = -1;

function updateDepth() {
  if (!layers.length || !depthLinks.length) return;
  var i = activeLayerIndex();
  if (i === activeIndex) return;    /* unchanged: skip the DOM write */
  activeIndex = i;

  for (var n = 0; n < depthLinks.length; n++) {
    var link = depthLinks[n];
    if (n === i) {
      link.setAttribute('aria-current', 'true');
    } else {
      link.removeAttribute('aria-current');
    }
    var slot = link.querySelector('.depth__m');
    /* Label each rail entry with the depth where its layer starts. The active
       layer is carried by aria-current, so there is deliberately no second
       live readout repeating the same name. */
    if (slot && layers[n]) {
      slot.textContent = (Math.round(layers[n].top * metresPerPx * 10) / 10) + ' m';
    }
  }

  /* Light the doorway of the row the sprite is standing at. The gate above
     means this only runs when the row actually changes. Guarded because a
     layer whose element is missing must not take the rest of the rail down
     with it. */
  for (var c = 0; c < layers.length; c++) {
    var chamber = layers[c].el;
    if (!chamber || !chamber.classList) continue;
    if (c === i) {
      chamber.classList.add('is-current');
    } else {
      chamber.classList.remove('is-current');
    }
  }
}
/* === Scroll cue ===========================================================
   "Scroll to descend" sits in the shaft, but the shaft is a grid column UNDER
   the canvas content (main is z-index:10, the stage z-index:0), so the cue
   paints on top of the car. That was harmless when the deck was a static line;
   now the car travels through that space and the cue would sit on it.

   So it fades out the first time the reader scrolls, and only then: it is a
   hint, and a hint that outlives its usefulness is just an obstruction. Gated
   on a flag so the class is written once and the element is then never touched
   again, rather than per frame. Under prefers-reduced-motion the CSS zeroes
   every transition, so the fade is instant for anyone who asked for that. */
var cue = document.querySelector('.dig__cue');
var cueGone = false;
function updateCue() {
  if (cueGone || !cue) return;
  if ((window.scrollY || 0) < 8) return;    /* a nudge, not a scroll */
  cueGone = true;
  cue.classList.add('is-gone');
}

/* === Buttons =============================================================
   This section used to hold the "Email" reveal button: a click assembled the
   address in JS and wrote it into a span, so the address never sat in the
   static HTML as a mailto: target for a scraper. It is now REMOVED, along with
   the button it was wired to - the Email / Download PDF / LinkedIn / GitHub row
   went with the treasure room's heading, and a new contact area is being built
   into the cave instead.

   Nothing is left here to guard, which is worth stating plainly: the old code
   was already written as `if (emailBtn && emailSlot)`, so removing the markup
   would not have thrown. Keeping a null-guarded handler for an element that no
   longer exists is worse than deleting it - it reads in review as a live
   feature, and the email address it assembled is still in this file's history.

   PRINTING IS UNAFFECTED. The Download PDF button was a plain <a download>, so
   no print behaviour was ever bound to it. Printing the resume is still fully
   supported: Ctrl/Cmd-P fires the beforeprint hook below, which opens the plain
   resume, and the @media print block in layout.css renders only that. */
/* === Plain resume disclosure ===============================================
   The plain resume deliberately duplicates the panels, so it is collapsed by
   default and only revealed when it is actually asked for:
     - the "Skip to plain resume" link,
     - a #plain-resume URL hash (including a shared/bookmarked link),
     - print, via beforeprint.
   CSS alone cannot open a closed <details>, which is why beforeprint exists;
   the print stylesheet is only a backup for engines that skip that event. */
var plainDetails = document.getElementById('plain-resume');
var wasOpenBeforePrint = false;

function openPlainResume() {
  if (plainDetails) plainDetails.open = true;
}

var skipLink = document.querySelector('.skip');
if (skipLink) {
  skipLink.addEventListener('click', function () { openPlainResume(); });
}

if (plainDetails && window.location.hash === '#plain-resume') {
  openPlainResume();
}
if (window.addEventListener) {
  window.addEventListener('hashchange', function () {
    if (window.location.hash === '#plain-resume') openPlainResume();
  });
}

/* Printing must include the document even though it is collapsed. */
window.addEventListener('beforeprint', function () {
  wasOpenBeforePrint = !!(plainDetails && plainDetails.open);
  openPlainResume();
});
window.addEventListener('afterprint', function () {
  if (plainDetails) plainDetails.open = wasOpenBeforePrint;
});

/* Public surface of this module. Collected here so that not one line of
   the code above needed a keyword added to it. */
export {
  updateDepth,
  updateCue
};
