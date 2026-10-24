/* Blood spatter effect, ported from the provided module. */
export interface BloodSpatterOptions {
  container?: HTMLElement;
  zIndex?: number;
  maxParticles?: number;
  minMoveDistance?: number;
  drips?: boolean;
  clickBurst?: boolean;
  darkMode?: boolean;
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

interface Drip {
  x: number;
  y: number;
  w: number;
  v: number;
  color: string;
}

interface SplatStamp {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  size: number;
  createdAt: number;
}

interface Point {
  x: number;
  y: number;
}

const TAU = Math.PI * 2;

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is not available");
  return ctx;
}

export function createBloodSpatter(
  options: BloodSpatterOptions = {}
): BloodSpatterInstance {
  const container = options.container ?? document.body;
  const zIndex = options.zIndex ?? 0;
  const maxParticles = options.maxParticles ?? 60;
  const minMove = options.minMoveDistance ?? 16;
  const clickBurst = options.clickBurst ?? true;
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
  let last: Point | null = null;
  let raf = 0;
  const parts: Particle[] = [];
  const drips: Drip[] = [];
  const splats: SplatStamp[] = [];
  const SPLAT_LIFE = 4000;

  const rand = Math.random;

  function resize(): void {
    const old = document.createElement("canvas");
    old.width = stain.width;
    old.height = stain.height;
    if (stain.width) old.getContext("2d")?.drawImage(stain, 0, 0);

    W = window.innerWidth;
    H = window.innerHeight;
    for (const c of [stain, fx]) {
      c.width = W * dpr;
      c.height = H * dpr;
    }
    sc.setTransform(dpr, 0, 0, dpr, 0, 0);
    fc.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (old.width) sc.drawImage(old, 0, 0, old.width / dpr, old.height / dpr);
  }

  function blood(shift = 0): string {
    const l = (dark ? 22 : 13) + rand() * 9 + shift;
    return `hsl(${rand() * 7}, ${90 + rand() * 9}%, ${l}%)`;
  }

  function splat(x: number, y: number, r: number, ang: number, speed: number): void {
    const size = Math.max(8, Math.ceil(r * 14));
    const stamp = document.createElement("canvas");
    stamp.width = size * dpr;
    stamp.height = size * dpr;
    const ctx = stamp.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    splats.push({ canvas: stamp, x, y, size, createdAt: performance.now() });
  }

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

  function onMove(e: PointerEvent): void {
    const t = e.target as Element | null;
    if (t && t.closest && t.closest("article, a, button, input, textarea, .group")) return;
    const x = e.clientX;
    const y = e.clientY;
    if (!last) {
      last = { x, y };
      return;
    }
    const dx = x - last.x;
    const dy = y - last.y;
    const sp = Math.hypot(dx, dy);
    if (sp > minMove) {
      const count = Math.min(2, 1 + Math.floor(sp * 0.03));
      spawn(x, y, Math.atan2(dy, dx), sp, count, 1.7);
      last = { x, y };
      if (sp > 60) spawnClaw(x, y, Math.atan2(dy, dx));
    }
  }

  function spawnClaw(x: number, y: number, ang: number): void {
    const size = 48;
    const stamp = document.createElement("canvas");
    stamp.width = size * dpr;
    stamp.height = size * dpr;
    const ctx = stamp.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(size / 2, size / 2);
    ctx.rotate(ang);
    ctx.strokeStyle = dark ? "#a01010" : "#7d0b0b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 5, -12);
      ctx.lineTo(i * 5 + 18, 12);
      ctx.stroke();
    }
    splats.push({ canvas: stamp, x, y, size, createdAt: performance.now() });
  }

  function onDown(e: PointerEvent): void {
    const t = e.target as Element | null;
    if (t && t.closest && t.closest("article, a, button, input, textarea, .group")) return;
    last = { x: e.clientX, y: e.clientY };
    spawn(e.clientX, e.clientY, 0, 90, 10, TAU);
  }

  function onLeave(): void {
    last = null;
  }

  function frame(): void {
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
            drips.push({
              x: p.x,
              y: p.y,
              w: p.r * (0.5 + rand() * 0.4),
              v: 0.6 + rand() * 1.1,
              color: blood(),
            });
          }
        }
        parts.splice(i, 1);
      }
    }

    for (let k = drips.length - 1; k >= 0; k--) {
      const d = drips[k];
      sc.strokeStyle = d.color;
      sc.fillStyle = d.color;
      sc.lineWidth = d.w;
      sc.lineCap = "round";
      sc.beginPath();
      sc.moveTo(d.x, d.y);
      sc.lineTo(d.x, d.y + d.v);
      sc.stroke();

      d.y += d.v;
      d.w *= 0.9975;
      d.v *= 0.993;

      if (d.v < 0.07 || d.w < 0.8 || d.y > H) {
        sc.beginPath();
        sc.arc(d.x, d.y, d.w * 0.75, 0, TAU);
        sc.fill();
        drips.splice(k, 1);
      }
    }

    // Fade splats out in FIFO order.
    const now = performance.now();
    for (let i = splats.length - 1; i >= 0; i--) {
      if (now - splats[i].createdAt > SPLAT_LIFE) splats.splice(i, 1);
    }
    sc.clearRect(0, 0, W, H);
    for (const sp of splats) {
      const age = (now - sp.createdAt) / SPLAT_LIFE;
      sc.globalAlpha = Math.max(0, 1 - age);
      sc.drawImage(sp.canvas, sp.x - sp.size / 2, sp.y - sp.size / 2, sp.size, sp.size);
    }
    sc.globalAlpha = 1;

    raf = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerleave", onLeave);
  if (clickBurst) window.addEventListener("pointerdown", onDown);
  raf = requestAnimationFrame(frame);

  return {
    clear(): void {
      sc.clearRect(0, 0, W, H);
      drips.length = 0;
      parts.length = 0;
      splats.length = 0;
    },
    destroy(): void {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      stain.remove();
      fx.remove();
    },
  };
}
