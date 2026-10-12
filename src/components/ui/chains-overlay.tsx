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

    const portraitEl = canvas.parentElement?.closest("[data-cage-drift]") as HTMLElement | null;
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
    let framePts: SimPoint[] = [];
    let lock: Lock | null = null;
    let locked: boolean = isLocked;

    let drag: SimPoint | null = null;
    let mouse = { x: 0, y: 0 };
    let animationFrame: number;

    const FRAME_K = 0.09;
    // Portrait and cage share ONE clamped rigid transform, so the cage
    // never outruns the photo during a lunge or drag.
    const CLAMP_POS = 14;
    const CLAMP_ROT = 0.06;
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

    function drawChainBar(
      top: { x: number; y: number },
      bottom: { x: number; y: number }
    ): void {
      if (!ctx) return;
      // A jail bar drawn as a taut vertical run of chain links, so it
      // matches the rest of the cage instead of reading as a solid rod.
      const dx = bottom.x - top.x;
      const dy = bottom.y - top.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) return;
      const n = Math.max(2, Math.round(len / (rest * 1.7)));
      let px = top.x;
      let py = top.y;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const nx2 = top.x + dx * t;
        const ny2 = top.y + dy * t;
        drawLink({ x: px, y: py }, { x: nx2, y: ny2 }, i % 2 === 1);
        px = nx2;
        py = ny2;
      }
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
      framePts = [];
      lock = null;

      // The chain canvas is centered on its wrapper by construction
      // (absolute left-1/2 top-1/2 -translate-1/2 inside the relative
      // [data-cage-drift] box), so the canvas center IS the portrait
      // center. No rect math needed — rects include live drift/translate
      // transforms and drift the cage off the photo.
      const hostEl = canvas.parentElement;
      const hostW = hostEl?.clientWidth ?? canvas.clientWidth;
      const hostH = hostEl?.clientHeight ?? canvas.clientHeight;
      const cx = canvas.clientWidth / 2;
      const cy = canvas.clientHeight / 2;
      rest = Math.max(6, Math.min(10, hostW / 38));
      fw = hostW + 56;
      fh = hostH + 56;
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

      // A single centred padlock. Its S/B points are im:0 (fixed by the
      // solver) and re-pinned to the portrait's centre every step, so it
      // stays centred and sways with the box instead of drooping over the
      // face. It clasps the middle vertical bar — no extra hang chains.
      const S = pt(cx, cy - rest * 3, 0);
      const B = pt(cx, cy - rest * 3 + rest * 2.2, 0);
      lock = { S, B, sw: rest * 1.3, bh: rest * 4.2, bw: rest * 2.8 };
      join(S, B, rest * 2.2);
    }

    function step() {
      const time = performance.now() / 1000;
      const { cx, cy, angle } = frameTransform();
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);

      // Keep the padlock centred on the portrait, riding the same clamped
      // motion as the photo so it never drifts off the middle vertical bar.
      if (lock) {
        const ldx = Math.max(-CLAMP_POS, Math.min(CLAMP_POS, cx - buildCx));
        const ldy = Math.max(-CLAMP_POS, Math.min(CLAMP_POS, cy - buildCy));
        lock.S.x = buildCx + ldx;
        lock.S.y = buildCy + ldy - rest * 3;
        lock.B.x = buildCx + ldx;
        lock.B.y = buildCy + ldy - rest * 3 + rest * 2.2;
      }

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

    function drawLink(
      a: { x: number; y: number },
      b: { x: number; y: number },
      dark: boolean
    ) {
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

      // The cage is drawn through the SAME clamped rigid transform the
      // portrait uses, so the box and bars move in lockstep with the photo
      // instead of outrunning it. Each simulated corner keeps its own
      // deformation (the organic wobble) layered on top of that shared pose.
      if (framePts.length >= 7) {
        const { cx, cy, angle } = frameTransform();
        const cdx = Math.max(-CLAMP_POS, Math.min(CLAMP_POS, cx - buildCx));
        const cdy = Math.max(-CLAMP_POS, Math.min(CLAMP_POS, cy - buildCy));
        const crot = Math.max(-CLAMP_ROT, Math.min(CLAMP_ROT, angle));
        const dx = cx - buildCx;
        const dy = cy - buildCy;
        const ca = Math.cos(crot);
        const sa = Math.sin(crot);
        const fa = Math.cos(angle);
        const fs = Math.sin(angle);

        // Simulated corner -> clamped rigid pose + its own deformation.
        const rig = (p: SimPoint) => {
          const ox = p.bx - buildCx;
          const oy = p.by - buildCy;
          const predX = buildCx + dx + fa * ox - fs * oy;
          const predY = buildCy + dy + fs * ox + fa * oy;
          return {
            x: buildCx + cdx + ca * ox - sa * oy + (p.x - predX),
            y: buildCy + cdy + sa * ox + ca * oy + (p.y - predY),
          };
        };

        const TL = rig(framePts[0]); // top-left
        const TR = rig(framePts[2]); // top-right
        const BR = rig(framePts[4]); // bottom-right
        const BL = rig(framePts[6]); // bottom-left

        // Box: four chain edges around the portrait.
        drawChainBar(TL, TR);
        drawChainBar(TR, BR);
        drawChainBar(BR, BL);
        drawChainBar(BL, TL);

        // Three vertical chain bars spanning top to bottom.
        const lx = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) =>
          a.x + (b.x - a.x) * t;
        const ly = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) =>
          a.y + (b.y - a.y) * t;
        for (const t of [0.25, 0.5, 0.75]) {
          drawChainBar(
            { x: lx(TL, TR, t), y: ly(TL, TR, t) },
            { x: lx(BL, BR, t), y: ly(BL, BR, t) }
          );
        }
      }

      padlock();
    }

    function loop() {
      step();
      draw();
      if (portraitEl) {
        const { cx, cy, angle } = frameTransform();
        // Portrait rides the cage 1:1 but clamped: wild chain motion stays
        // visible while the portrait itself can never leave its box and
        // break the hero layout.
        const dx = Math.max(-CLAMP_POS, Math.min(CLAMP_POS, cx - buildCx));
        const dy = Math.max(-CLAMP_POS, Math.min(CLAMP_POS, cy - buildCy));
        const rot = Math.max(-CLAMP_ROT, Math.min(CLAMP_ROT, angle));
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
    // Rebuild when the wrapper box changes size — the portrait image loads
    // async, so the first build measures an empty box and the cage ends up
    // misaligned until something forces a rebuild.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
      ro = new ResizeObserver(() => {
        build();
      });
      ro.observe(canvas.parentElement);
      const img = canvas.parentElement.querySelector("img");
      if (img) ro.observe(img);
    }
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    build();
    loop();

    return () => {
      window.removeEventListener("resize", build);
      if (ro) ro.disconnect();
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



