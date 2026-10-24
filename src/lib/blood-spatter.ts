/**
 * Blood spatter + claw wounds.
 *
 * - Normal mouse movement flings a few droplets that splat and sometimes drip.
 * - A fast swipe (speed >= clawSpeed, measured in px per millisecond) rakes a
 *   set of parallel claw gashes that tear open along the swipe direction, then
 *   blood wells up and oozes down from them.
 */

export interface BloodSpatterOptions {
  container?: HTMLElement;
  zIndex?: number;
  maxParticles?: number;
  minMoveDistance?: number;
  drips?: boolean;
  clickBurst?: boolean;
  darkMode?: boolean;
  /** Chance (0-1) that an eligible mouse move throws droplets. Default 0.2 */
  spatterChance?: number;
  /** Enable claw wounds. Default true */
  claws?: boolean;
  /** Mouse speed in px/ms needed to rake claws (2.2 = a brisk flick). Default 2.2 */
  clawSpeed?: number;
  /** Minimum ms between two claw wounds. Default 700 */
  clawCooldown?: number;
  /** Max claw wounds on screen at once; oldest is removed first. Default 4 */
  maxWounds?: number;
  /** How long a splat stays before it has fully faded (ms). Default 4000 */
  splatLifeMs?: number;
  /** How long a wound stays before it has fully faded (ms). Default 14000 */
  woundLifeMs?: number;
  /** Pointer events starting on matching elements are ignored. */
  ignoreSelector?: string;
}

export interface BloodSpatterInstance {
  clear(): void;
  destroy(): void;
}

interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
}

/** A pre-rendered piece of the scene. Optional tick() keeps drawing into it. */
interface Mark {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
  born: number;
  life: number;
  wound: boolean;
  tick?: (dt: number) => boolean;
}

interface GashPoint {
  x: number;
  y: number;
  nx: number;
  ny: number;
  w: number;
}

type Gash = GashPoint[];

interface Ooze {
  x: number;
  y: number;
  w: number;
  v: number; // px per ms
  vol: number; // total distance it can travel
  travelled: number;
  delay: number;
  phase: number;
  seed: number;
  color: string;
  done: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Sample extends Point {
  t: number;
}

const TAU = Math.PI * 2;
const GASH_STEPS = 30;
const REVEAL_MS = 240;
const OOZE_ROOM = 280;

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is not available");
  return ctx;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function createBloodSpatter(
  options: BloodSpatterOptions = {}
): BloodSpatterInstance {
  const container = options.container ?? document.body;
  const zIndex = options.zIndex ?? 0;
  const maxParticles = options.maxParticles ?? 60;
  const minMove = options.minMoveDistance ?? 16;
  const clickBurst = options.clickBurst ?? true;
  const spatterChance = options.spatterChance ?? 0.2;
  const clawsOn = options.claws ?? true;
  const clawSpeed = options.clawSpeed ?? 2.2;
  const clawCooldown = options.clawCooldown ?? 700;
  const maxWounds = options.maxWounds ?? 4;
  const splatLife = options.splatLifeMs ?? 4000;
  const woundLife = options.woundLifeMs ?? 14000;
  const ignoreSelector =
    options.ignoreSelector ?? "article, a, button, input, textarea, .group";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const allowDrips = (options.drips ?? true) && !reduced;
  const dark =
    options.darkMode ?? window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const makeCanvas = (): HTMLCanvasElement => {
    const c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    Object.assign(c.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: String(zIndex),
    });
    container.appendChild(c);
    return c;
  };

  const stain = makeCanvas();
  const fx = makeCanvas();
  const sc = getContext(stain);
  const fc = getContext(fx);

  let W = 0;
  let H = 0;
  let raf = 0;
  let lastFrame = performance.now();
  let dirty = false;
  const parts: Particle[] = [];
  const marks: Mark[] = [];

  const rand = Math.random;

  // Pointer tracking
  let prev: Sample | null = null;
  let spatterAnchor: Point | null = null;
  let vel = 0;
  let dirX = 1;
  let dirY = 0;
  let fastCount = 0;
  let lastClawAt = -Infinity;

  function resize(): void {
    W = window.innerWidth;
    H = window.innerHeight;
    for (const c of [stain, fx]) {
      c.width = W * dpr;
      c.height = H * dpr;
    }
    sc.setTransform(dpr, 0, 0, dpr, 0, 0);
    fc.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true; // marks are re-rendered every frame, so nothing is lost
  }

  function blood(shift = 0): string {
    const l = (dark ? 22 : 13) + rand() * 9 + shift;
    return `hsl(${rand() * 7}, ${90 + rand() * 9}%, ${l}%)`;
  }

  // ---------- marks ----------

  function makeMark(
    x: number,
    y: number,
    w: number,
    h: number,
    life: number,
    wound = false
  ): { mark: Mark; ctx: CanvasRenderingContext2D } {
    const cw = clamp(Math.ceil(w), 4, 1400);
    const ch = clamp(Math.ceil(h), 4, 1400);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(cw * dpr);
    canvas.height = Math.ceil(ch * dpr);
    const ctx = getContext(canvas);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mark: Mark = {
      canvas,
      x,
      y,
      w: cw,
      h: ch,
      born: performance.now(),
      life,
      wound,
    };
    return { mark, ctx };
  }

  function addMark(mark: Mark): void {
    marks.push(mark);
    dirty = true;
  }

  // ---------- splats and drips ----------

  function splat(x: number, y: number, r: number, ang: number, speed: number): void {
    const size = Math.max(8, Math.ceil(r * 14));
    const { mark, ctx } = makeMark(x - size / 2, y - size / 2, size, size, splatLife);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(ang);
    ctx.fillStyle = blood();

    ctx.beginPath();
    ctx.ellipse(0, 0, r * (1 + Math.min(speed, 20) * 0.04), r, 0, 0, TAU);
    ctx.fill();

    const lobes = 4 + Math.floor(rand() * 5);
    for (let i = 0; i < lobes; i++) {
      const a = rand() * TAU;
      const d = r * (0.5 + rand() * 0.7);
      const lr = r * (0.25 + rand() * 0.45);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, lr, 0, TAU);
      ctx.fill();
    }

    const sats = 1 + Math.floor(rand() * 3);
    for (let j = 0; j < sats; j++) {
      const sa = (rand() - 0.5) * 1.1;
      const sd = r * (1.8 + rand() * 4.5);
      const sr = 0.4 + rand() * r * 0.28;
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * sd, Math.sin(sa) * sd, sr, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = blood(-7);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#ff5a4a";
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.22, r * 0.12, -0.5, 0, TAU);
    ctx.fill();
    ctx.restore();

    addMark(mark);
  }

  /** A drip gets its own mark so it fades together with its splat. */
  function startDrip(x: number, y: number, width: number, v: number, color: string): void {
    const bw = Math.ceil(width * 2 + 8);
    const h = Math.min(240, Math.max(20, H - y));
    const { mark, ctx } = makeMark(x - bw / 2, y, bw, h, splatLife + 3000);
    const cx = bw / 2;
    let py = 0;
    let w = width;
    let speed = v / 16.67; // px per ms
    mark.tick = (dt: number): boolean => {
      const y0 = py;
      py += speed * dt;
      const f = dt / 16.67;
      w *= Math.pow(0.9975, f);
      speed *= Math.pow(0.993, f);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, y0);
      ctx.lineTo(cx, py);
      ctx.stroke();
      if (speed < 0.0042 || w < 0.8 || py > h - 4) {
        ctx.beginPath();
        ctx.arc(cx, py, w * 0.75, 0, TAU);
        ctx.fill();
        return false;
      }
      return true;
    };
    addMark(mark);
  }

  // ---------- claw wounds ----------

  const woundLayers: ReadonlyArray<readonly [number, string]> = [
    [1.9, `hsl(4, 55%, ${dark ? 40 : 34}%)`], // inflamed torn skin
    [1.0, `hsl(0, 85%, ${dark ? 16 : 12}%)`], // deep cut
    [0.42, `hsl(0, 92%, ${dark ? 34 : 28}%)`], // fresh blood in the middle
  ];

  function buildGash(p0: Point, p1: Point, p2: Point, wmax: number): Gash {
    const pts: Gash = [];
    for (let i = 0; i <= GASH_STEPS; i++) {
      const t = i / GASH_STEPS;
      const mt = 1 - t;
      const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
      const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
      const tx = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
      const ty = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
      const tl = Math.hypot(tx, ty) || 1;
      // Deepest near the entry, tapering to a point; edges are torn unevenly.
      const profile = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.6);
      const jitter = 1 + (rand() - 0.5) * 0.4;
      pts.push({ x, y, nx: -ty / tl, ny: tx / tl, w: wmax * profile * jitter });
    }
    return pts;
  }

  function drawStrip(ctx: CanvasRenderingContext2D, g: Gash, a: number, b: number): void {
    if (b <= a) return;
    for (const [k, color] of woundLayers) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = a; i <= b; i++) {
        const p = g[i];
        const hw = p.w * 0.5 * k;
        const px = p.x + p.nx * hw;
        const py = p.y + p.ny * hw;
        if (i === a) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let i = b; i >= a; i--) {
        const p = g[i];
        const hw = p.w * 0.5 * k;
        ctx.lineTo(p.x - p.nx * hw, p.y - p.ny * hw);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  function makeOozes(gashes: Gash[]): Ooze[] {
    const list: Ooze[] = [];
    for (const g of gashes) {
      const n = 2 + (rand() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const idx = clamp(Math.floor(6 + rand() * (GASH_STEPS - 9)), 0, GASH_STEPS);
        const p = g[idx];
        list.push({
          x: p.x,
          y: p.y,
          w: 3 + rand() * 3.5,
          v: 0.03 + rand() * 0.04,
          vol: 70 + rand() * 150,
          travelled: 0,
          delay: 100 + rand() * 1100,
          phase: rand() * 10,
          seed: rand() * TAU,
          color: blood(6),
          done: false,
        });
      }
    }
    return list;
  }

  function stepOoze(ctx: CanvasRenderingContext2D, o: Ooze, dt: number, maxY: number): void {
    if (o.done) return;

    if (o.delay > 0) {
      o.delay -= dt;
      if (o.delay <= 0) {
        // blood wells up in the cut before it starts to run
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.w * 1.05, 0, TAU);
        ctx.fill();
      }
      return;
    }

    // Thick blood runs in surges and nearly stalls between them.
    o.phase += dt * 0.0035;
    const flow = 0.3 + 0.7 * Math.max(0, Math.sin(o.phase * 2 + o.seed));
    const frac = o.travelled / o.vol;
    const step = o.v * flow * dt * (1 - 0.7 * frac);
    const nx = o.x + Math.sin(o.travelled * 0.04 + o.seed) * 0.22 * step;
    const ny = o.y + step;

    ctx.strokeStyle = o.color;
    ctx.lineCap = "round";
    ctx.lineWidth = o.w * (0.6 + 0.4 * (1 - frac));
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(nx, ny);
    ctx.stroke();

    o.x = nx;
    o.y = ny;
    o.travelled += step;

    if (o.travelled >= o.vol || o.y >= maxY - 4) {
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.w * 0.8, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#ff6a58";
      ctx.beginPath();
      ctx.arc(o.x - o.w * 0.2, o.y - o.w * 0.25, o.w * 0.22, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      o.done = true;
    }
  }

  function spawnClaw(x: number, y: number, ang: number, speed: number): void {
    // Keep only the newest wounds.
    const existing = marks.filter((m) => m.wound);
    if (existing.length >= maxWounds) {
      const i = marks.indexOf(existing[0]);
      if (i >= 0) marks.splice(i, 1);
    }

    const len = clamp(110 + speed * 30, 120, 260);
    const count = rand() < 0.5 ? 3 : 4;
    const spacing = 15 + rand() * 7;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const nx = -dy;
    const ny = dx;
    const curve = (rand() - 0.5) * len * 0.28;
    // the rake ends at the cursor and trails behind it
    const cx = x - dx * (len * 0.5 - 10);
    const cy = y - dy * (len * 0.5 - 10);

    const raw: Array<[Point, Point, Point]> = [];
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * spacing + (rand() - 0.5) * 3;
      const L = len * (0.82 + rand() * 0.18);
      const shift = (len - L) * 0.5 + (rand() - 0.5) * 8;
      const bend = curve + (rand() - 0.5) * 8;
      const p0 = { x: cx + dx * (-L / 2 + shift) + nx * off, y: cy + dy * (-L / 2 + shift) + ny * off };
      const p2 = { x: cx + dx * (L / 2 + shift) + nx * off, y: cy + dy * (L / 2 + shift) + ny * off };
      const p1 = { x: (p0.x + p2.x) / 2 + nx * bend, y: (p0.y + p2.y) / 2 + ny * bend };
      raw.push([p0, p1, p2]);
    }

    const wmax = 4.5 + rand() * 3;
    let gashes: Gash[] = raw.map(([a, b, c]) => buildGash(a, b, c, wmax));

    // Bounding box in screen space, with room underneath for the ooze.
    const pad = wmax * 2 + 10;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const g of gashes) {
      for (const p of g) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
    const bx = minX - pad;
    const by = minY - pad;
    const bw = maxX - minX + pad * 2;
    const bh = maxY - minY + pad * 2 + OOZE_ROOM;

    // Shift points into the mark's local space.
    gashes = gashes.map((g) => g.map((p) => ({ ...p, x: p.x - bx, y: p.y - by })));

    const { mark, ctx } = makeMark(bx, by, bw, bh, woundLife, true);
    let progress = 0;
    let oozes: Ooze[] = [];

    const tick = (dt: number): boolean => {
      if (progress < 1) {
        const from = progress;
        progress = Math.min(1, progress + dt / REVEAL_MS);
        const a = Math.max(0, Math.floor(from * GASH_STEPS) - 1);
        const b = Math.min(GASH_STEPS, Math.ceil(progress * GASH_STEPS));
        for (const g of gashes) drawStrip(ctx, g, a, b);
        if (progress >= 1) {
          // flecks of blood thrown beside the cuts
          for (let i = 0; i < 8; i++) {
            const g = gashes[Math.floor(rand() * gashes.length)];
            const p = g[Math.floor(rand() * GASH_STEPS)];
            const side = rand() < 0.5 ? -1 : 1;
            const d = p.w * 1.2 + 3 + rand() * 10;
            ctx.fillStyle = blood(2);
            ctx.beginPath();
            ctx.arc(p.x + p.nx * side * d, p.y + p.ny * side * d, 0.6 + rand() * 1.6, 0, TAU);
            ctx.fill();
          }
          oozes = makeOozes(gashes);
        }
        return true;
      }
      let active = false;
      for (const o of oozes) {
        stepOoze(ctx, o, dt, mark.h);
        if (!o.done) active = true;
      }
      return active;
    };

    if (reduced) {
      // no animation: render the finished wound straight away
      for (let n = 0; n < 3000 && tick(16); n++) {
        /* run to completion */
      }
    } else {
      mark.tick = tick;
    }

    addMark(mark);
    spawn(x, y, ang, speed * 14, 3, 1.4);
  }

  // ---------- flying droplets ----------

  function spawn(
    x: number,
    y: number,
    ang: number,
    speed: number,
    count: number,
    spread: number
  ): void {
    for (let i = 0; i < count && parts.length < maxParticles; i++) {
      const a = ang + (rand() - 0.5) * spread;
      const v = speed * 0.08 * (0.3 + rand()) + rand() * 2;
      parts.push({
        x,
        y,
        px: x,
        py: y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - rand() * 1.5,
        r: 5 + rand() * 8 * (1 + speed / 90),
        life: 12 + rand() * 32,
      });
    }
  }

  // ---------- input ----------

  function isIgnored(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(ignoreSelector) !== null;
  }

  function resetPointer(): void {
    prev = null;
    spatterAnchor = null;
    vel = 0;
    fastCount = 0;
  }

  function onMove(e: PointerEvent): void {
    const now = performance.now();
    const x = e.clientX;
    const y = e.clientY;

    if (!prev) {
      prev = { x, y, t: now };
      return;
    }
    const dt = now - prev.t;
    if (dt < 8) return; // measure speed over a stable window

    const dx = x - prev.x;
    const dy = y - prev.y;
    const dist = Math.hypot(dx, dy);
    vel = vel * 0.5 + (dist / dt) * 0.5;
    if (dist > 0.5) {
      dirX = dirX * 0.4 + (dx / dist) * 0.6;
      dirY = dirY * 0.4 + (dy / dist) * 0.6;
      const n = Math.hypot(dirX, dirY) || 1;
      dirX /= n;
      dirY /= n;
    }
    prev = { x, y, t: now };

    if (isIgnored(e.target)) {
      fastCount = 0;
      return;
    }

    // Fast enough, for long enough, and not too soon after the last one.
    fastCount = vel >= clawSpeed ? fastCount + 1 : 0;
    if (clawsOn && fastCount >= 2 && now - lastClawAt > clawCooldown) {
      lastClawAt = now;
      fastCount = 0;
      spatterAnchor = { x, y };
      spawnClaw(x, y, Math.atan2(dirY, dirX), vel);
      return;
    }

    if (!spatterAnchor) {
      spatterAnchor = { x, y };
      return;
    }
    const sd = Math.hypot(x - spatterAnchor.x, y - spatterAnchor.y);
    if (sd > minMove && rand() < spatterChance) {
      const count = Math.min(2, 1 + Math.floor(sd * 0.03));
      spawn(x, y, Math.atan2(y - spatterAnchor.y, x - spatterAnchor.x), sd, count, 1.7);
      spatterAnchor = { x, y };
    }
  }

  function onDown(e: PointerEvent): void {
    if (isIgnored(e.target)) return;
    spawn(e.clientX, e.clientY, 0, 90, 10, TAU);
  }

  // ---------- main loop ----------

  function frame(now: number): void {
    const dt = Math.min(50, now - lastFrame);
    lastFrame = now;

    fc.clearRect(0, 0, W, H);
    fc.lineCap = "round";

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.px = p.x;
      p.py = p.y;
      p.vy += 0.35;
      p.vx *= 0.97;
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      fc.strokeStyle = dark ? "#a01010" : "#7d0b0b";
      fc.lineWidth = p.r * 1.5;
      fc.beginPath();
      fc.moveTo(p.px, p.py);
      fc.lineTo(p.x, p.y);
      fc.stroke();

      if (p.life <= 0 || p.y > H) {
        if (p.y <= H) {
          splat(p.x, p.y, p.r, Math.atan2(p.vy, p.vx), Math.hypot(p.vx, p.vy));
          if (allowDrips && p.r > 6 && rand() < 0.6) {
            startDrip(p.x, p.y, p.r * (0.5 + rand() * 0.4), 0.6 + rand() * 1.1, blood());
          }
        }
        parts.splice(i, 1);
      }
    }

    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i];
      if (m.tick && !m.tick(dt)) m.tick = undefined;
      if (now - m.born > m.life) marks.splice(i, 1);
    }

    if (dirty || marks.length > 0) {
      sc.clearRect(0, 0, W, H);
      for (const m of marks) {
        const age = now - m.born;
        const hold = m.life * 0.5;
        sc.globalAlpha = age < hold ? 1 : Math.max(0, 1 - (age - hold) / (m.life - hold));
        sc.drawImage(m.canvas, m.x, m.y, m.w, m.h);
      }
      sc.globalAlpha = 1;
      dirty = marks.length > 0;
    }

    raf = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerleave", resetPointer);
  if (clickBurst) window.addEventListener("pointerdown", onDown);
  raf = requestAnimationFrame(frame);

  return {
    clear(): void {
      sc.clearRect(0, 0, W, H);
      parts.length = 0;
      marks.length = 0;
      dirty = false;
    },
    destroy(): void {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", resetPointer);
      window.removeEventListener("pointerdown", onDown);
      stain.remove();
      fx.remove();
    },
  };
}
