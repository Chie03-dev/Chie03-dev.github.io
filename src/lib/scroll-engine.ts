/**
 * Shared scroll engine. A single native scroll/resize listener drives one
 * requestAnimationFrame loop that feeds every scroll-linked effect on the page
 * (parallax rails, hero banner drift, the dusk overlay). Effects subscribe for
 * the global 0..1 page progress, and/or register an element whose 0..1
 * "travelled through the viewport" progress is written to a CSS variable.
 *
 * This replaces the many independent per-component listeners/rAF loops with one,
 * so every effect updates in the same frame (perfectly synced) at minimal cost.
 * Everything is transform/opacity based. When the visitor prefers reduced motion
 * the engine stops updating and snaps effects to a neutral state, and their CSS
 * also neutralises the transforms under the same media query.
 *
 * Client-only: instantiated lazily inside effects, so it never runs during SSR.
 */

type Listener = (global: number) => void;

class ScrollEngine {
  private listeners = new Set<Listener>();
  private tracked = new Map<HTMLElement, string>();
  private rafId = 0;
  private attached = false;
  private motionQuery: MediaQueryList | null = null;
  private static _instance: ScrollEngine | null = null;

  reducedMotion = false;

  static get shared(): ScrollEngine {
    if (!ScrollEngine._instance) {
      ScrollEngine._instance = new ScrollEngine();
    }
    return ScrollEngine._instance;
  }

  private constructor() {
    if (typeof window === "undefined") return;
    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.motionQuery.matches;
    this.motionQuery.addEventListener("change", this.handleMotionChange);
  }

  /** Subscribe to global page progress (0 at the top, 1 at the bottom). */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.reducedMotion ? 0 : this.globalProgress());
    this.sync();
    return () => {
      this.listeners.delete(listener);
      this.sync();
    };
  }

  /**
   * Track an element: each frame its 0..1 travel-through-viewport progress is
   * written to `varName` (default "--p"). Returns an untrack function.
   */
  track(el: HTMLElement, varName = "--p"): () => void {
    this.tracked.set(el, varName);
    this.writeElement(el, varName);
    this.sync();
    return () => {
      this.tracked.delete(el);
      this.sync();
    };
  }

  private globalProgress(): number {
    const max =
      document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }

  private writeElement(el: HTMLElement, varName: string) {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    // 0 when the element's top first enters from the bottom of the viewport,
    // 1 once its bottom edge has left the top.
    const p = Math.min(1, Math.max(0, (vh - rect.top) / (rect.height + vh)));
    el.style.setProperty(varName, p.toFixed(4));
  }

  private handleMotionChange = (event: MediaQueryListEvent) => {
    this.reducedMotion = event.matches;
    if (this.reducedMotion) this.snapToRest();
  };

  /** Neutralise every effect when reduced motion is switched on mid-session. */
  private snapToRest() {
    for (const [el, varName] of this.tracked) {
      el.style.setProperty(varName, "0.5");
    }
    for (const listener of this.listeners) listener(0);
  }

  private onScroll = () => {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(this.tick);
  };

  private tick = () => {
    this.rafId = 0;
    if (this.reducedMotion) return;
    const g = this.globalProgress();
    for (const [el, varName] of this.tracked) this.writeElement(el, varName);
    for (const listener of this.listeners) listener(g);
  };

  /** Attach the single listener only while something is subscribed/tracked. */
  private sync() {
    const active = this.listeners.size > 0 || this.tracked.size > 0;
    if (active && !this.attached) {
      window.addEventListener("scroll", this.onScroll, { passive: true });
      window.addEventListener("resize", this.onScroll);
      this.attached = true;
    } else if (!active && this.attached) {
      window.removeEventListener("scroll", this.onScroll);
      window.removeEventListener("resize", this.onScroll);
      this.attached = false;
    }
  }
}

/** Access the process-wide scroll engine (created lazily, client-only). */
export function getScrollEngine(): ScrollEngine {
  return ScrollEngine.shared;
}
