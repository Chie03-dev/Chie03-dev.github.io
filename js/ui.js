/* ==========================================================================
   ui.js - the DOM side: reveals and the depth rail
   ==========================================================================
   The IntersectionObserver panel reveals and the depth rail active marker. All
   resume text stays in index.html as real HTML; this only wires behaviour to it.
   textContent and createElement only, never innerHTML.

   The plain-resume disclosure and its print hook used to live here too. Both are
   gone, along with the element they drove - see the note further down for what
   that cost. */

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

   PRINTING IS GONE. The Download PDF button was a plain <a download>, so no
   print behaviour was ever bound to it and the contact block's "Print resume"
   link still works. What DID break is Ctrl/Cmd-P: see the note below. */
/* === Plain resume: REMOVED ==================================================
   There used to be a <details id="plain-resume"> here: a second, collapsed copy
   of the whole resume, opened by the "Skip to plain resume" link, by a
   #plain-resume URL hash, and by beforeprint. All four of those are gone with
   it - the markup, the skip link, this opening handler and the print hook.

   WHAT THAT COSTS, stated plainly rather than left for someone to discover:

   PRINTING. The @media print block in layout.css used to hide the game and
   render only the plain resume. With the plain resume gone there is nothing
   sensible left for it to isolate, so it is gone too, and Ctrl/Cmd-P now prints
   the page as it appears on screen - canvas and all. The print resume link in
   the contact block is unaffected: it is a plain <a download> to the real PDF
   in assets/, and was never a print button. That is now the only way to get a
   printable resume, which is a real loss of a working feature rather than a
   cleanup.

   ACCESSIBILITY. The skip link was the keyboard and screen-reader escape hatch
   out of the scroll game. Without it there is no such way out - a keyboard user
   reaching the end of the page now simply ends there. Everything the panels
   hold is still real, semantic HTML and still reachable by tabbing, so this is
   not a wall, but the shortcut is gone and the panels are far apart. */

/* Public surface of this module. Collected here so that not one line of
   the code above needed a keyword added to it. */
export {
  updateDepth,
  updateCue
};
