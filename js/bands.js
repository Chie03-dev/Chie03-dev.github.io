/* ==========================================================================
   bands.js - turning measured panels into contiguous layer bands
   --------------------------------------------------------------------------
   A PANEL is the <section> box: the dark slab the resume text sits in. A BAND
   is the slice of rock a layer owns, and it is deliberately NOT the same
   rectangle as the panel.

   Why they were split: measure() used to take the band's top and height
   straight off the section rect, so a band and its panel were the same box by
   construction. The panel is opaque and paints on top (main is z-index:10, the
   canvas z-index:0), which meant every chamber covered the entire middle of its
   own layer. The biome art could then only be placed in whatever was left over
   - see gutters() in biomes.js, a function that exists purely to work around
   the collision. The layers read as flat washes with a card pasted on top.

   The rule here: a band spans from the midpoint of the gap ABOVE its panel to
   the midpoint of the gap BELOW it. Three properties fall out of that, and all
   three matter:

     1. Every band is strictly taller than its panel, so rock and its jagged
        seam are visible above and below every chamber instead of being hidden
        behind it.
     2. Adjacent bands share an edge exactly, so the bands TILE the document.
        Midpoints cannot cross, because each one lies inside its own gap. That
        is also what removes the unpainted full-width strips the row-gap used to
        leave between layers.
     3. Band tops stay strictly increasing, which is the invariant
        layerIndexAt() and activeLayerIndex() depend on to pick the current
        layer from a scroll position.

   Pure geometry, no imports and no DOM: it takes measured panel edges and
   returns band edges. That keeps the reasoning testable on its own and keeps
   layers.js under the 500-line cap.
   ========================================================================== */

/* `panels` needs panelTop/panelBottom on each entry, in document pixels, in
   top-to-bottom order. `floorY` is where the last band has to end: the bottom
   of the treasure room, so the final layer reaches all the way down instead of
   stopping short and leaving bare canvas below it.

   Returns one {top, bottom, height} per panel, in the same order. A band is
   never inverted: if a caller hands over overlapping or degenerate panels the
   band collapses to zero height at its own top rather than running backwards,
   because a reversed band would make layerIndexAt() non-monotonic. */
function bandEdges(panels, floorY) {
  var n = panels.length, i, out = [];
  for (i = 0; i < n; i++) {
    var prev = i > 0 ? panels[i - 1] : null;
    var next = i + 1 < n ? panels[i + 1] : null;
    /* First band starts at the top of the document, last one ends at floorY;
       everything in between is the midpoint of its own gap. */
    var top = prev
      ? Math.round((prev.panelBottom + panels[i].panelTop) / 2)
      : 0;
    var bot = next
      ? Math.round((panels[i].panelBottom + next.panelTop) / 2)
      : Math.round(floorY);
    if (bot < top) bot = top;
    out.push({ top: top, bottom: bot, height: bot - top });
  }
  return out;
}

/* Public surface, collected at the bottom to match every other module in this
   project and so the graph check in tools/smoke.mjs can read it. */
export { bandEdges };