"use client";

import { useEffect, useRef } from "react";

interface SimPoint {
  x: number;
  y: number;
  px: number;
  py: number;
  im: number;
  bx: number;
  by: number;
  tx?: number;
  ty?: number;
  k?: number;
}
interface Constraint {
  a: SimPoint;
  b: SimPoint;
  d: number;
  /** Ropes only resist stretching - they never push endpoints apart. */
  rope?: boolean;
}

interface Lock {
  S: SimPoint;
  B: SimPoint;
  sw: number;
  bh: number;
  bw: number;
}

interface ChainsOverlayProps {
  className?: string;
  isLocked: boolean;
}

export function ChainsOverlay({
  className = "",
  isLocked,
}: ChainsOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const portraitEl = canvas.parentElement?.querySelector("img");
    // Respect the OS reduced-motion preference: when set, the cage stays calm
    // (no restless fidgeting or lunges) instead of emulating a caged animal.
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    // Unlocked: containment is broken, so the cage is gone. Ease the portrait
    // back to its natural position and skip the simulation entirely; the canvas
    // itself fades out via a CSS opacity transition (see className below).
    if (!isLocked) {
      if (portraitEl) {
        portraitEl.style.transition = "transform 600ms ease";
        portraitEl.style.transform = "";
      }
      return;
    }
    // Locked: clear any leftover transition so the per-frame transform writes
    // from the simulation apply instantly instead of lagging behind.
    if (portraitEl) portraitEl.style.transition = "";

    const GRAVITY = 0.8;
    const SOLVER_ITERATIONS = 24;
    // Clamp per-frame velocity so the periodic "lunge" impulses below can never
    // blow the solver up.
    const MAX_V = 40;

    let W = 0;
    let H = 0;
    let rest = 10;
    let fw = 200;
    let fh = 250;

    let points: SimPoint[] = [];
    let constraints: Constraint[] = [];
    let hang: SimPoint[][] = [];
    let belts: SimPoint[][] = [];
    let framePts: SimPoint[] = [];
    let lock: Lock | null = null;
    let locked: boolean = isLocked;

    let drag: SimPoint | null = null;
    let mouse = { x: 0, y: 0 };
    let animationFrame: number;

    const FRAME_K = 0.09;
    let buildCx = 0;
    let buildCy = 0;

    function pt(x: number, y: number, im: number): SimPoint {
      const p: SimPoint = { x, y, px: x, py: y, im, bx: x, by: y };
      points.push(p);
      return p;
    }

    function join(a: SimPoint, b: SimPoint, d?: number, rope = false) {
      constraints.push({
        a,
        b,
        d: d ?? Math.hypot(a.x - b.x, a.y - b.y),
        rope,
      });
    }

    function chainTo(A: SimPoint, T: SimPoint, slack: number): SimPoint[] {
      const d = Math.hypot(T.x - A.x, T.y - A.y);
      const n = Math.max(4, Math.ceil((d * slack) / rest));
      const L = n * rest;
      const s = Math.sqrt(Math.max(0, (3 * d * (L - d)) / 8));
      const arr: SimPoint[] = [A];

      for (let k = 1; k < n; k++) {
        const t = k / n;
        arr.push(
          pt(
            A.x + (T.x - A.x) * t,
            A.y + (T.y - A.y) * t + 4 * s * t * (1 - t),
            1
          )
        );
      }
      arr.push(T);

      for (let k = 0; k < n; k++) {
        join(arr[k], arr[k + 1], rest, true);
      }
      return arr;
    }

    function makeBelt(
      phi: number,
      bcx: number,
      bcy: number,
      scale = 1,
      ox = 0,
      oy = 0
    ) {
      const co = Math.cos(phi);
      const si = Math.sin(phi);
      const half =
        1 /
        Math.max(
          Math.abs(co) / ((fw / 2) * scale),
          Math.abs(si) / ((fh / 2) * scale)
        );
      const r = rest * 0.8;
      const a = half + rest * 2.5 - r;
      const per = 4 * a + 2 * Math.PI * r;
      const n = Math.round(per / rest / 2) * 2;
      const d = per / n;
      const pts: SimPoint[] = [];

      for (let i = 0; i < n; i++) {
        let s = i * d;
        let u = 0;
        let v = 0;

        if (s < 2 * a) {
          u = -a + s;
          v = -r;
        } else if ((s -= 2 * a) < Math.PI * r) {
          const t = -Math.PI / 2 + s / r;
          u = a + r * Math.cos(t);
          v = r * Math.sin(t);
        } else if ((s -= Math.PI * r) < 2 * a) {
          u = a - s;
          v = r;
        } else {
          s -= 2 * a;
          const t = Math.PI / 2 + s / r;
          u = -a + r * Math.cos(t);
          v = r * Math.sin(t);
        }

        const lx = u * co - v * si;
        const ly = u * si + v * co;
        const p = pt(bcx + ox + lx, bcy + oy + ly, 1);
        p.tx = ox + lx;
        p.ty = oy + ly;
        p.k = Math.abs(u) > half ? 0.05 : 0.22;
        pts.push(p);
      }

      for (let i = 0; i < n; i++) {
        join(pts[i], pts[(i + 1) % n], d);
      }

      for (const p of pts) {
        let near = framePts[0];
        let nd = Infinity;
        for (const f of framePts) {
          const dist = Math.hypot(f.bx - p.bx, f.by - p.by);
          if (dist < nd) {
            nd = dist;
            near = f;
          }
        }
        join(p, near, nd);
      }
      belts.push(pts);
    }

    function frameTransform() {
      if (!framePts.length) return { cx: buildCx, cy: buildCy, angle: 0 };
      let cx = 0;
      let cy = 0;
      for (const p of framePts) {
        cx += p.x;
        cy += p.y;
      }
      cx /= framePts.length;
      cy /= framePts.length;
      const angle = framePts.length
        ? Math.atan2(framePts[2].y - framePts[0].y, framePts[2].x - framePts[0].x)
        : 0;
      return { cx, cy, angle };
    }

    function build() {
      if (!canvas || !ctx) return;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw < 1 || ch < 1) {
        if (canvas.isConnected) animationFrame = requestAnimationFrame(build);
        return;
      }
      W = canvas.width = cw * devicePixelRatio;
      H = canvas.height = ch * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

      points = [];
      constraints = [];
      hang = [];
      belts = [];
      framePts = [];
      lock = null;

      // Size and center the cage on the host element (the portrait container)
      // so the chains wrap the image instead of the whole section.
      const canvasRect = canvas.getBoundingClientRect();
      const host = canvas.parentElement?.getBoundingClientRect();
      const hostW = host?.width ?? canvas.clientWidth;
      const hostH = host?.height ?? canvas.clientHeight;
      const cx = host ? host.left - canvasRect.left + hostW / 2 : canvas.clientWidth / 2;
      const cy = host ? host.top - canvasRect.top + hostH / 2 : canvas.clientHeight / 2;
      rest = Math.max(6, Math.min(10, hostW / 38));
      fw = hostW * 0.96;
      fh = hostH * 0.94;
      buildCx = cx;
      buildCy = cy;

      const loc = [
        [-1, -1],
        [0, -1],
        [1, -1],
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
        [-1, 0],
      ];

      framePts = loc.map(([a, b]) =>
        pt(cx + (a * fw) / 2, cy + (b * fh) / 2, 0.5)
      );

      // Perimeter edges + the two corner diagonals keep the frame rigid as a
      // unit. Both diagonals must be corner-to-corner (TL↔BR and TR↔BL) and
      // symmetric; a lopsided constraint set biases the solver and drifts the
      // cage sideways, so it can never be centred on the portrait again.
      for (let i = 0; i < 8; i++) {
        join(framePts[i], framePts[(i + 1) % 8]);
      }
      join(framePts[0], framePts[4]); // TL ↔ BR
      join(framePts[2], framePts[6]); // TR ↔ BL

      // Padlock sits at the portrait centre so the chains radiate from the
      // middle: corner diagonals form an X and the horizontal/vertical cross
      // chains pass through it.
      const S = pt(cx, cy - rest * 3, 0);
      const B = pt(cx, cy - rest * 0.5, 0);
      lock = { S, B, sw: rest * 1.3, bh: rest * 4.2, bw: rest * 2.8 };
      join(S, B, rest * 2.2);

      // Corner diagonals converge on the centre padlock (an X across the frame).
      const corners = [framePts[0], framePts[2], framePts[4], framePts[6]];
      for (const c of corners) {
        hang.push(chainTo(c, S, 1.12));
      }
      // Horizontal cross: left-mid → padlock → right-mid.
      hang.push(chainTo(framePts[7], S, 1.05));
      hang.push(chainTo(S, framePts[3], 1.05));
      // Vertical cross: top-mid → padlock → bottom-mid.
      hang.push(chainTo(framePts[1], S, 1.05));
      hang.push(chainTo(S, framePts[5], 1.05));

      // Cage wraps the portrait from several directions: two horizontal belts
      // (upper & lower) and two vertical belts (left & right), each offset from
      // centre so they band the image at different spots - the "contained" look.
      // All are axis-aligned (phi 0 or PI/2) and mirrored about the centre, so
      // their solver forces cancel instead of drifting the cage sideways (a 45deg
      // belt did exactly that and was removed). Verified drift-free in simulation.
      const oy = 0.95 * (fh / 2);
      const ox = 0.95 * (fw / 2);
      makeBelt(0, cx, cy, 0.95, 0, -oy); // upper horizontal
      makeBelt(0, cx, cy, 0.95, 0, oy); // lower horizontal
      makeBelt(Math.PI / 2, cx, cy, 0.95, -ox, 0); // left vertical
      makeBelt(Math.PI / 2, cx, cy, 0.95, ox, 0); // right vertical
    }

    function step() {
      const time = performance.now() / 1000;
      const { cx, cy, angle } = frameTransform();
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);

      for (const p of points) {
        if (p.im === 0) continue;
        const vx = Math.max(-MAX_V, Math.min(MAX_V, p.x - p.px));
        const vy = Math.max(-MAX_V, Math.min(MAX_V, p.y - p.py));
        p.px = p.x;
        p.py = p.y;
        p.x += vx * 0.99;
        p.y += vy * 0.99 + GRAVITY * p.im;
      }

      // Safety net: recover any point that went non-finite so a single
      // unstable solve can never blank the whole canvas.
      for (const p of points) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
          p.x = p.bx;
          p.y = p.by;
          p.px = p.bx;
          p.py = p.by;
        }
      }

      // Animalistic restlessness: while caged, the portrait fidgets and
      // periodically strains against its chains like a trapped animal.
      // Skipped entirely under prefers-reduced-motion.
      if (!reducedMotion) {
        // Fidget: low-amplitude multi-octave jitter, each frame point
        // phase-offset so the cage shivers organically instead of in unison.
        // The extra "rocking" terms scale each point's push by its distance
        // from centre with opposite signs top/bottom and left/right, so the
        // whole cage rolls and pitches - a much more visible sway.
        for (let i = 0; i < framePts.length; i++) {
          const p = framePts[i];
          const ph = i * 1.7;
          const lx = (p.bx - buildCx) / (fw / 2);
          const ly = (p.by - buildCy) / (fh / 2);
          p.x += Math.sin(time * 2.1 + ph) * 0.35 + Math.sin(time * 5.3 + ph * 2.7) * 0.18;
          p.y += Math.cos(time * 1.7 + ph * 1.3) * 0.3 + Math.sin(time * 4.1 + ph) * 0.15;
          p.x += Math.sin(time * 1.3) * 0.9 * ly;
          p.y += Math.sin(time * 1.1 + 1.0) * 0.5 * lx;
        }

        // Lunge: roughly every 5s the animal yanks the cage in a
        // semi-random downward-ish direction for ~1.2s. The impulse is
        // weighted toward the points on the lunge side, so the cage tilts,
        // the ropes strain, then the anchor spring snaps it back.
        const LUNGE_INTERVAL = 3.2;
        const LUNGE_WINDOW = 0.28;
        const lungePhase = time / LUNGE_INTERVAL;
        const frac = lungePhase - Math.floor(lungePhase);
        if (frac < LUNGE_WINDOW) {
          const seed = Math.floor(lungePhase);
          const h1 = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
          const h2 = Math.abs(Math.sin(seed * 78.233) * 43758.5453) % 1;
          const lungeAngle = -Math.PI / 2 + (h1 - 0.5) * Math.PI * 0.9;
          const env = Math.sin((frac / LUNGE_WINDOW) * Math.PI);
          const strength = (6 + h2 * 6) * env;
          for (const p of framePts) {
            const rel =
              ((p.bx - buildCx) * Math.cos(lungeAngle) + (p.by - buildCy) * Math.sin(lungeAngle)) /
              (fw / 2);
            const w = 0.4 + 0.6 * Math.max(0, rel);
            p.x += Math.cos(lungeAngle) * strength * w;
            p.y += Math.sin(lungeAngle) * strength * w;
          }
        }
      }

      // Soft anchor: the frame drifts back toward its build pose, so it
      // swings when disturbed and slowly settles back around the portrait.
      for (const p of framePts) {
        p.x += (p.bx - p.x) * FRAME_K;
        p.y += (p.by - p.y) * FRAME_K;
      }

      for (let i = 0; i < SOLVER_ITERATIONS; i++) {
        for (const c of constraints) {
          const dx = c.b.x - c.a.x;
          const dy = c.b.y - c.a.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (c.rope && dist < c.d) continue;
          const diff = (dist - c.d) / dist;
          const ax = dx * diff * 0.5;
          const ay = dy * diff * 0.5;
          if (c.a.im) {
            c.a.x += ax * c.a.im;
            c.a.y += ay * c.a.im;
          }
          if (c.b.im) {
            c.b.x -= ax * c.b.im;
            c.b.y -= ay * c.b.im;
          }
        }
      }

      // Belt shape spring: hold every link at its build offset from the
      // frame's current center/rotation so the belt rides the frame.
      for (const p of points) {
        if (p.tx === undefined || p.ty === undefined || p.k === undefined)
          continue;
        const tx = cx + p.tx * ca - p.ty * sa;
        const ty = cy + p.tx * sa + p.ty * ca;
        p.x += (tx - p.x) * p.k * p.im;
        p.y += (ty - p.y) * p.k * p.im;
      }

      if (drag && drag.im) {
        drag.x = mouse.x;
        drag.y = mouse.y;
      }
    }

    function drawLink(a: SimPoint, b: SimPoint, dark: boolean) {
      if (!ctx) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const L = Math.hypot(dx, dy);
      if (!L) return;
      const ang = Math.atan2(dy, dx);
      const w = rest * 0.52;

      ctx.save();
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.translate(mx, my);
      ctx.rotate(ang);

      const gr = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
      if (dark) {
        gr.addColorStop(0, "#3b4045");
        gr.addColorStop(0.5, "#8d9499");
        gr.addColorStop(1, "#f4f1ea");
      } else {
        gr.addColorStop(0, "#f4f1ea");
        gr.addColorStop(0.5, "#8d9499");
        gr.addColorStop(1, "#3b4045");
      }

      // Contrast halo first, so each link stays fully readable on both
      // light and dark backgrounds (the gradient alone loses its light half
      // on light backgrounds and vice versa).
      ctx.strokeStyle = "rgba(20, 24, 28, 0.35)";
      ctx.lineWidth = Math.max(3, rest * 0.4);
      ctx.beginPath();
      ctx.roundRect(-L / 2, -w / 2, L, w, w / 2);
      ctx.stroke();

      ctx.strokeStyle = gr;
      ctx.lineWidth = Math.max(2, rest * 0.26);
      ctx.beginPath();
      ctx.roundRect(-L / 2, -w / 2, L, w, w / 2);
      ctx.stroke();
      ctx.restore();
    }

    function padlock() {
      if (!lock || !ctx) return;
      const { S, B, sw, bh, bw } = lock;
      const dx = B.x - S.x;
      const dy = B.y - S.y;

      ctx.save();
      ctx.translate(S.x, S.y);
      ctx.rotate(Math.atan2(-dx, dy));

      ctx.save();
      if (!locked) {
        ctx.translate(sw, sw * 2.2);
        ctx.rotate(-0.6);
        ctx.translate(-sw, -sw * 2.2 - 5);
      }

      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(20, 24, 28, 0.35)";
      ctx.lineWidth = rest * 0.5;
      ctx.beginPath();
      ctx.moveTo(-sw, sw * 2.4);
      ctx.lineTo(-sw, sw);
      ctx.arc(0, sw, sw, Math.PI, 0);
      ctx.lineTo(sw, sw * 2.4);
      ctx.stroke();

      ctx.strokeStyle = "#c9ced2";
      ctx.lineWidth = rest * 0.36;
      ctx.beginPath();
      ctx.moveTo(-sw, sw * 2.4);
      ctx.lineTo(-sw, sw);
      ctx.arc(0, sw, sw, Math.PI, 0);
      ctx.lineTo(sw, sw * 2.4);
      ctx.stroke();
      ctx.restore();

      const y0 = sw * 2.2 - 2;
      const gd = ctx.createLinearGradient(-bw / 2, y0, bw / 2, y0 + bh);
      gd.addColorStop(0, "#f3dc8c");
      gd.addColorStop(0.5, "#c39a38");
      gd.addColorStop(1, "#7d5c1a");

      ctx.fillStyle = gd;
      ctx.beginPath();
      ctx.roundRect(-bw / 2, y0, bw, bh, 5);
      ctx.fill();

      ctx.fillStyle = "#2a1d0c";
      ctx.beginPath();
      ctx.arc(0, y0 + bh * 0.42, bw * 0.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W / devicePixelRatio, H / devicePixelRatio);

      for (const ch of hang) {
        for (let i = 0; i < ch.length - 1; i += 2) {
          drawLink(ch[i], ch[i + 1], false);
        }
        for (let i = 1; i < ch.length - 1; i += 2) {
          drawLink(ch[i], ch[i + 1], true);
        }
      }

      for (const pts of belts) {
        for (let i = 0; i < pts.length; i++) {
          drawLink(pts[i], pts[(i + 1) % pts.length], i % 2 === 1);
        }
      }

      padlock();

      for (const ch of hang) {
        ctx.beginPath();
        ctx.arc(ch[0].x, ch[0].y, 9, 0, Math.PI * 2);
        ctx.fillStyle = "#4a4f54";
        ctx.fill();
      }
    }

    function loop() {
      step();
      draw();
      if (portraitEl) {
        const { cx, cy, angle } = frameTransform();
        // Portrait rides the cage 1:1 but clamped: wild chain motion stays
        // visible while the portrait itself can never leave its box and
        // break the hero layout.
        const dx = Math.max(-14, Math.min(14, cx - buildCx));
        const dy = Math.max(-14, Math.min(14, cy - buildCy));
        const rot = Math.max(-0.06, Math.min(0.06, angle));
        if (Number.isFinite(dx) && Number.isFinite(dy) && Number.isFinite(rot)) {
          portraitEl.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}rad)`;
        }
      }
      animationFrame = requestAnimationFrame(loop);
    }

    function getMousePos(e: PointerEvent) {
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onPointerDown(e: PointerEvent) {
      mouse = getMousePos(e);
      canvas?.setPointerCapture(e.pointerId);

      if (lock) {
        const mx = (lock.S.x + lock.B.x) / 2;
        const my = (lock.S.y + lock.B.y) / 2;
        if (Math.hypot(mouse.x - mx, mouse.y - my) < rest * 2.4) {
          if (locked) {
            locked = false;
          } else {
            build();
          }
          return;
        }
      }

      const t = frameTransform();
      const dx = mouse.x - t.cx;
      const dy = mouse.y - t.cy;
      const lx = dx * Math.cos(-t.angle) - dy * Math.sin(-t.angle);
      const ly = dx * Math.sin(-t.angle) + dy * Math.cos(-t.angle);

      if (Math.abs(lx) < fw / 2 && Math.abs(ly) < fh / 2) {
        let best: SimPoint | null = null;
        let bd = Infinity;
        for (const p of framePts) {
          const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
        drag = best;
        return;
      }

      let best: SimPoint | null = null;
      let bd = 44;
      for (const p of points) {
        if (!p.im) continue;
        const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      drag = best;
    }

    function onPointerMove(e: PointerEvent) {
      mouse = getMousePos(e);
    }

    function onPointerUp() {
      drag = null;
    }

    window.addEventListener("resize", build);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    build();
    loop();

    return () => {
      window.removeEventListener("resize", build);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      cancelAnimationFrame(animationFrame);
    };
  }, [isLocked]);

  return (
    <canvas
      ref={canvasRef}
      // A <canvas> is a replaced element: with position:absolute and both
      // left/right (or top/bottom) set but width:auto, it keeps its intrinsic
      // 300x150 size and ignores the insets, so negative insets never resize
      // it. Set an explicit CSS size via inline style (100% of the portrait
      // container + 18rem of headroom on every side) and centre it with a
      // transform. Inline style avoids relying on Tailwind's arbitrary-value
      // scanner for the calc().
      style={{ width: "calc(100% + 18rem)", height: "calc(100% + 18rem)" }}
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 transition-opacity duration-700 ${
        isLocked
          ? "cursor-grab active:cursor-grabbing opacity-100"
          : "pointer-events-none opacity-0"
      } ${className}`}
    />
  );
}