import { type CSSProperties } from "react";

/**
 * The layered scenery band across the top of the hero.
 *
 * Built from the aligned SVG pack in `public/backgroundstuff` — two whole
 * variants (`sunset/` and `night/`), each thirteen layers sharing a 1920x720
 * viewBox with `preserveAspectRatio="xMidYMax slice"`, so they stack without
 * any coordinate drift and crop themselves to fill.
 *
 * Two whole variants ship side by side and crossfade: **sunset** while the
 * hero is contained, **night** once it is broken (`.unbound-mode` on <html>),
 * so unlocking the cage turns the sky to a full moonlit night. That mirrors
 * `--dusk-max-opacity` below.
 *
 * Parallax is entirely CSS-driven. The parent section already publishes its
 * 0..1 travel as `--hp` through the shared scroll engine, so each layer just
 * reads that variable and offsets by its own intensity — no extra listeners,
 * rAF loops, or client state. Layers translate *up* as the band scrolls away,
 * nearer ones fastest, which is what sells the depth. A bottom gradient fade
 * melts the band's ground edge into the page background, so the band never
 * cuts a hard seam against the hero content below it.
 *
 * Presentational only: no hooks, so it stays a plain module.
 */

/** Total vertical travel (px) at full scroll for the most intense layer. */
const TRAVEL = 970;

interface Layer {
  /** Filename segment: `/backgroundstuff/{variant}/{name}.svg`. */
  name: string;
  /** Parallax intensity scaled to the pack's depth order (0.10 = sky, 0.72 = front fog). */
  intensity: number;
  /**
   * Resting downward offset (px) applied before any scroll drift. The tree
   * layers carry a small one so their silhouette tops settle inside the seam
   * fade at the band's bottom edge instead of standing proud above it.
   */
  base?: number;
}

/**
 * Back-to-front, matching the pack's documented stacking order (see
 * `preview.html` in either variant folder), minus the pack's ground/road and
 * village layers — the forest layers already fill to the canvas bottom on
 * their own, and the band reads cleaner without the built scenery. Fog sits
 * at three depths interleaved with the trees; the vignette is the one
 * exception to the ramp — it pins to the band (intensity 0) so the darkened
 * frame stays aligned while the world drifts behind it.
 */
const LAYERS: Layer[] = [
  { name: "01-sky", intensity: 0.1 },
  { name: "03-mountains-far", intensity: 0.17 },
  { name: "04-fog-back", intensity: 0.21 },
  { name: "05-mountains-mid", intensity: 0.27 },
  { name: "06-forest-far", intensity: 0.33, base: 20 },
  { name: "09-fog-mid", intensity: 0.51 },
  { name: "10-forest-mid", intensity: 0.58, base: 30 },
  { name: "11-forest-front", intensity: 0.66, base: 80 },
  { name: "12-fog-front", intensity: 0.72 },
  { name: "13-vignette", intensity: 0 },
];

const VARIANTS = ["night", "sunset"] as const;

/**
 * Per-layer motion. `--p-y` is the upward offset applied as `--hp` grows;
 * `--p-overscan` grows the element by exactly that much at the bottom so the
 * travel never exposes a gap under the layer; `--p-base` is a fixed resting
 * drop (see `Layer.base`) that positions the silhouette before any drift.
 */
function layerStyle({ intensity, base = 0 }: Layer): CSSProperties {
  const y = -(intensity * TRAVEL);
  return {
    "--p-y": `${y.toFixed(1)}px`,
    "--p-overscan": `${Math.abs(y).toFixed(1)}px`,
    "--p-base": `${base}px`,
  } as CSSProperties;
}

export function HeroBanner() {
  return (
    <div className="relative -z-20 aspect-video max-h-[80vh] min-h-[1vh] w-full overflow-hidden">
      {VARIANTS.map((variant) => (
        <div
          key={variant}
          aria-hidden="true"
          className={`hero-banner-stack hero-banner-stack--${variant} absolute inset-0`}
        >
          {LAYERS.map((layer) => (
            // Plain <img> deliberately: the site is a static export with
            // images.unoptimized, and these are small decorative vectors, so
            // next/image would pass the src through untouched while adding a
            // dynamic import to the hero.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={layer.name}
              src={`/backgroundstuff/${variant}/${layer.name}.svg`}
              alt=""
              draggable={false}
              className="hero-parallax-layer"
              style={layerStyle(layer)}
            />
          ))}
        </div>
      ))}
      {/* Seam fade: the ground silhouette's hard bottom edge would otherwise
          cut a straight line across the page. Fades into the current page
          background (both themes) so the scenery melts into the hero content
          below. Pinned to the band rather than parallaxed, so the blend stays
          put while the ground drifts behind it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[25%] bg-gradient-to-b from-background/0 to-background"
      />
    </div>
  );
}