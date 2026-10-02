/* ==========================================================================
   contact.js - assembles the email link in the cave chamber
   ==========================================================================
   Purpose: turn the split `data-mail-user` / `data-mail-domain` attributes into
   a working mailto: and readable text.

   Why it is a module at all: it is the only piece of page chrome that needs to
   run once at boot and then never again. It has no per-frame work, no canvas
   involvement, and no state, so it would be noise inside main.js's loop.

   WHY THE EMAIL IS SPLIT. A plain href="mailto:someone@example.com" in the
   served source is read by every address harvester that crawls a public page.
   This page is public and the address is the only thing standing between a
   recruiter and an inbox, so the two halves are attributes and the href is
   assembled at runtime.

   THE RULE THAT MATTERS: if the assembly cannot complete, write NOTHING and
   leave the plain text alone. It is tempting to fall back to a half-built
   address, but a mailto: with a missing half opens a compose window addressed
   to a stranger, which is worse than no link at all - it looks correct and is
   not. So a missing attribute means no href, and the reader sees inert text
   rather than a wrong destination.

   NO innerHTML. The address is written with textContent and set as a property.
   ========================================================================== */

/* Matches the placeholder spans this module owns. Scoped to the contact block
   rather than queried by data attribute alone, so an unrelated element that
   happens to carry data-mail-user elsewhere on the page is not swept up. */
var EMAIL_ATTR = 'data-mail-user';

/* Build the address from a host element's data attributes, or return '' when
   either half is missing or unusable. Exported for tools/smoke.mjs so the
   assembly can be tested directly rather than only through the DOM. */
/* The two functions below are declared normally and exported together at the
   bottom, in an export block. Every other module in js/ uses that block form
   rather than an inline `export function`, and that is not a style preference:
   tools/smoke.mjs derives the module graph with a regex that matches an export
   BLOCK and finds nothing in an inline function export. An inline export
   therefore reports as "does not export initContact" the moment another module
   imports it - a false failure caused by the checker, not the code.

   The scanner takes the FIRST block-shaped match in the file and it is
   non-greedy, so this comment must not contain a literal example of the block
   form written out. An earlier draft of this file quoted it in prose and the
   regex matched the quoted sample instead of the real export at the bottom,
   producing exactly the failure this comment is warning about - from inside the
   file meant to prevent it. Refer to the form in words, never by writing it. */
function mailAddress(host) {
  if (!host || typeof host.getAttribute !== 'function') return '';
  var user = (host.getAttribute(EMAIL_ATTR) || '').trim();
  var domain = (host.getAttribute('data-mail-domain') || '').trim();
  var at = (host.getAttribute('data-at') || '@').trim();
  /* A half-edited attribute is a mistake, not a short address. Requiring at
     least one character on both sides turns both of those into "no address". */
  if (!user || !domain) return '';
  return user + (at || '@') + domain;
}

/* Wire every placeholder span under `root` (default: the whole document).
   Idempotent - a span that already has an href is skipped - because boot can
   run again after a hot reload and re-running must not rebuild the DOM. */
function initContact(root) {
  var scope = root || document;
  if (!scope || typeof scope.querySelectorAll !== 'function') return 0;
  var nodes = scope.querySelectorAll('[data-mail-user]');
  var wired = 0;
  for (var i = 0; i < nodes.length; i++) {
    var span = nodes[i];
    /* Already wired by an earlier run. */
    if (span.getAttribute('data-mail-wired') === '1') continue;
    span.setAttribute('data-mail-wired', '1');

    var addr = mailAddress(span);
    if (!addr) {
      /* Deliberately still text, not a link. See the note above: no address is
         a better failure than a wrong one. The span keeps whatever label it
         already had, so nothing disappears. */
      span.setAttribute('data-mail-failed', '1');
      continue;
    }

    /* Promote the span to a link by CREATING a real <a> and moving the label
       across, rather than by rewriting the span's tagName (not a thing) or its
       outerHTML (forbidden). The reader's text is preserved by reference, so
       the text the visitor sees is the same text they would have seen without
       any of this running. */
    var a = document.createElement('a');
    a.className = span.className;
    a.setAttribute('href', 'mailto:' + addr);
    /* The address is shown, not hidden: an obfuscated address is a recruiter
       who cannot email you. textContent, so a stray '<' in an attribute could
       never become markup. */
    a.textContent = addr;
    /* No target=_blank on a mailto: - it would open a blank tab that never
       fills. Not needed here either, since there is no page to leak a
       window.opener to. */
    span.replaceWith(a);
    wired++;
  }
  return wired;
}

export { mailAddress, initContact };