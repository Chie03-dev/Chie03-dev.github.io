/* ==========================================================================
   ui.js - the DOM side: reveals, depth rail, buttons, plain resume
   ==========================================================================
   The IntersectionObserver panel reveals, the depth rail active marker, the
   print and email buttons, and the plain-resume disclosure with its print
   hook. All resume text stays in index.html as real HTML; this only wires
   behaviour to it. textContent and createElement only, never innerHTML.
   ========================================================================== */

import {
  layers, layerIndexAt, metresPerPx, scrollY
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

  var panels = document.querySelectorAll('.chamber, .treasure');
  for (var p = 0; p < panels.length; p++) io.observe(panels[p]);
} else {
  /* No observer support: show everything rather than hide content. */
  var fallback = document.querySelectorAll('.chamber, .treasure');
  for (var f = 0; f < fallback.length; f++) fallback[f].classList.add('is-visible');
}
/* === Depth meter =========================================================
   The active layer comes from layerIndexAt(scrollY), which is scroll
   bookkeeping, not panel reveal: panels still use IntersectionObserver.
   Writes are gated on an actual change so the DOM is not touched 60x a
   second while scrolling.

   This is also what lights the doorways. The sprite is walled into the
   shaft, so "the row the sprite is on" is exactly the row scrollY is in,
   which is the same index that highlights a depth-rail entry. Reusing it
   means the lit doorway and the active rail entry cannot drift apart, and
   it costs one classList call per row on change rather than a second
   scroll handler. */
var depthLinks = document.querySelectorAll('.depth__list a');
var activeIndex = -1;

function updateDepth() {
  if (!layers.length || !depthLinks.length) return;
  var i = layerIndexAt(scrollY);
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
/* === Buttons =============================================================
   textContent only. No innerHTML anywhere in this file.

   Download PDF is a plain <a download> in the markup now, so there is no print
   handler left in this module. Printing the resume is still fully supported:
   Ctrl/Cmd-P fires the beforeprint hook below, which opens the plain resume,
   and the @media print block in layout.css renders only that. Nothing about the
   printed output depended on the button. */

var emailBtn = document.getElementById('reveal-email');
var emailSlot = document.getElementById('email-slot');
if (emailBtn && emailSlot) {
  emailBtn.addEventListener('click', function () {
    if (emailBtn.dataset.done === '1') return;
    emailBtn.dataset.done = '1';
    emailBtn.textContent = 'Email';
    emailBtn.disabled = true;
    /* Assembled in JS so the address never sits in the static HTML as a
       mailto: target for a scraper. See docs/privacy decision. */
    var local = ['alchieandilab', '2003', 'gmail.com'];
    var addr = local[0] + local[1] + '@' + local[2];
    var a = document.createElement('a');
    a.href = 'mailto:' + addr;
    a.textContent = addr;
    emailSlot.appendChild(a);
  });
}
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
  updateDepth
};
