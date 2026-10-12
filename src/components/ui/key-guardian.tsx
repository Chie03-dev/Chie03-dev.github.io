"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/*
 * The Vault Key — an interactive guardian mini-game rendered on a single
 * <canvas>, no libraries.
 *
 * A shadow guardian clutches a golden key. The visitor grabs the key and carries
 * it out of this band, up to the hero's containment cage, and drops it there to
 * break containment. The guardian swats to knock the key loose along the way, so
 * the carry has to be won — and the drop has to land squarely on the cage.
 *
 * Two portability choices keep it cheap and responsive:
 *  - The simulation steps on a fixed 60Hz timestep decoupled from paint, so
 *    physics stay identical regardless of display refresh rate.
 *  - Every dimension is a fraction of `S = min(width, height)`, so a single
 *    code path scales to any box with no breakpoints.
 *
 * It pauses entirely when scrolled out of view or the tab is hidden — except
 * mid-carry, since the page scrolls the hero into view during a drag. It also
 * keeps working (minus ambient motion) under prefers-reduced-motion.
 *
 * Client-only by construction: the canvas, observers, listeners and the
 * requestAnimationFrame loop are all created inside an effect, so SSR and
 * hydration stay side-effect free.
 */

/** Fixed simulation step (ms). Physics advance in whole frames. */
const FRAME_MS = 16.667;

/** Downward acceleration applied once the key is knocked loose. */
const GRAVITY = 0.5;

/** Frames of pointer proximity before the guardian commits to a swat. */
const REACT_FRAMES = 14;

/** Frames between swat attempts. */
const COOLDOWN_FRAMES = 90;

/** Grab radius around the key, in units of S. */
const GRAB_RADIUS = 0.09;

/**
 * Drop target: the hero portrait's containment cage. Dragging the key out of the
 * guardian's band and releasing it here breaks containment.
 */
const PORTRAIT_ID = "hero-portrait";

type KeyMode = "home" | "drag" | "free" | "return" | "claimed";
type ArmStage = "idle" | "windup" | "swipe" | "recover";

interface KeyBody {
  x: number;
  y: number;
  /** Rotation (radians). */
  a: number;
  vx: number;
  vy: number;
  /** Angular velocity. */
  va: number;
  mode: KeyMode;
  /** Frames spent settled on the floor before it floats home. */
  rest: number;
  /** Grab offset from the pointer, so the key doesn't snap to the cursor. */
  ox: number;
  oy: number;
}

/** A two-bone arm: shoulder -> elbow -> claw, positioned with simple IK. */
interface Arm {
  side: -1 | 1;
  stage: ArmStage;
  /** Frames spent in the current stage. */
  t: number;
  /** Guards the hit test so one swipe damages at most once. */
  hit: boolean;
  /** Shoulder (fixed to the body). */
  sx: number;
  sy: number;
  /** Resting hand position. */
  rx: number;
  ry: number;
  /** Bone length. */
  L: number;
  /** Smoothed hand target. */
  hx: number;
  hy: number;
  /** Elbow (from IK). */
  ex: number;
  ey: number;
  /** Claw (hand). */
  cx: number;
  cy: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Remaining life in frames. */
  l: number;
}

export interface KeyGuardianProps {
  /** Fired when containment breaks — by dropping the key on the cage. */
  onClaim: () => void;
  /** Fired only when the carried-key hover state over the cage changes. */
  onDropHot?: (hot: boolean) => void;
  className?: string;
}

/**
 * Read a CSS custom property as a cv color. cv silently ignores
 * unparseable color strings, so the value is probed and a fallback is used
 * when it is rejected (an unset or malformed token).
 */
function readColor(
  c: CanvasRenderingContext2D,
  name: string,
  fallback: string,
): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return fallback;
  c.fillStyle = "#123456";
  const sentinel = c.fillStyle;
  c.fillStyle = raw;
  const accepted = c.fillStyle;
  c.fillStyle = "#000000";
  return accepted === sentinel ? fallback : raw;
}

export function KeyGuardian({ onClaim, onDropHot, className }: KeyGuardianProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  // Floating key that follows the pointer once it is dragged out of the canvas.
  const ghostRef = useRef<HTMLDivElement>(null);

  // Keep the latest callbacks reachable from the animation loop without making
  // them loop dependencies (the caller's identities change on every render).
  const onClaimRef = useRef(onClaim);
  const onDropHotRef = useRef(onDropHot);
  useEffect(() => {
    onClaimRef.current = onClaim;
    onDropHotRef.current = onDropHot;
  }, [onClaim, onDropHot]);

  // Handle to the loop's claim routine, so the keyboard fallback button and a
  // genuine in-game win take the exact same path.
  const claimRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const rawCanvas = canvasRef.current;
    const rawLive = liveRef.current;
    if (!stage || !rawCanvas || !rawLive) return;

    // Aliases of the narrowed values. TypeScript discards control-flow
    // narrowing inside hoisted function declarations, so each non-null value is
    // re-bound to a const whose declared type is already non-nullable. That
    // keeps the null checks here without repeating them at every use site.
    const cv = rawCanvas;
    const context = cv.getContext("2d");
    const liveEl = rawLive;
    if (!context) return;

    // Re-bind the non-null context to a const: hoisted function declarations
    // below lose the narrowing from the check above, and a `let` would widen it
    // back to nullable everywhere.
    const c: CanvasRenderingContext2D = context;

    const accent = readColor(c, "--primary", "#e0a13a");

    const BODY = "#050308";
    const GOLD_HI = "#fff0a8";
    const GOLD_MID = "#d9a52b";
    const GOLD_LO = "#7a5410";
    const EYE = "#e4140f";

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motionQuery.matches;

    let W = 0;
    let H = 0;
    let dpr = 1;
    /** Master scale: min(width, height). Every size derives from this. */
    let S = 0;
    /** Monster-body scale: S shrunk by MONSTER. Body, arms, eyes, and mouth
     * draw from this; the key, grab radius, physics, and strike targets keep
     * full S so the game plays identically. */
    let MS = 0;
    /**
     * Guardian body scale. The monster reads oversized next to the key game,
     * so the body, arms, and eyes draw at 70% while the key, grab radius, and
     * alert distances keep full scale — the game stays exactly as playable.
     */
    const MONSTER = 0.7;
    /**
     * Horizontal squeeze applied to the body silhouette, eyes, mouth, and arm
     * anchors. Only widths slim — heights stay full so he reads thinner, not
     * shorter.
     */
    const SLIM = 0.62;
    let cx = 0;
    let cy = 0;
    /** Guardian body centre — sits just below the key's home position. */
    let mx = 0;
    let my = 0;
    /** Frame counter driving all ambient oscillation. */
    let t = 0;
    let acc = 0;
    let last = performance.now();

    let mouse: { x: number; y: number } | null = null;
    let nearT = 0;
    let alertLevel = 0;
    let shake = 0;
    let blink = 0;
    let blinkT = 200;
    let cool = 0;
    let claimed = false;
    /** 0..1 post-win fade as the guardian recoils. */
    let defeat = 0;
    let visible = true;
    let raf = 0;

    /*
     * Drag-out state. The key can be carried out of this band and dropped on the
     * hero's cage, so the drag is tracked in viewport coordinates alongside the
     * canvas-local sim.
     */
    /** Pointer position in client (viewport) coordinates, while dragging. */
    let pointerClient: { x: number; y: number } | null = null;
    /** True when the carried key is hovering the cage drop zone. */
    let dropHot = false;
    /**
     * True once the pointer has carried the key outside the canvas band. The
     * DOM ghost is visible there, so the canvas key is hidden for the same
     * span — otherwise a second key is visible sitting back on the pedestal.
     */
    let keyEscaped = false;
    /** Ensures the hero is pulled into view only once per drag. */
    let scrolledForDrag = false;

    /** Direction the key is launched: always away from the pointer. */
    const dir = { x: 1, y: 0 };
    const parts: Particle[] = [];

    const key: KeyBody = {
      x: 0,
      y: 0,
      a: 0,
      vx: 0,
      vy: 0,
      va: 0,
      mode: "home",
      rest: 0,
      ox: 0,
      oy: 0,
    };

    const makeArm = (side: -1 | 1): Arm => ({
      side,
      stage: "idle",
      t: 0,
      hit: false,
      sx: 0,
      sy: 0,
      rx: 0,
      ry: 0,
      L: 0,
      hx: 0,
      hy: 0,
      ex: 0,
      ey: 0,
      cx: 0,
      cy: 0,
    });

    const arms: Arm[] = [makeArm(-1), makeArm(1)];


    /* ---- sizing ---- */

    /**
     * Re-measure the cv. Sizes are derived from S so the whole scene scales
     * as one unit; a ResizeObserver (not window.resize) drives this so it reacts
     * to the container, not the viewport.
     */
    function layout() {
      dpr = window.devicePixelRatio || 1;
      W = cv.clientWidth;
      H = cv.clientHeight;
      // A zero-size box (display:none, or mid-layout) would divide by zero.
      if (W === 0 || H === 0) return;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      S = Math.min(W, H);
      MS = S * MONSTER;
      cx = W / 2;
      cy = H / 2;
      mx = cx;
      my = cy + 0.2 * S;

      for (const a of arms) {
        a.sx = cx + a.side * 0.3 * MS * SLIM;
        a.sy = cy + 0.14 * MS;
        a.rx = cx + a.side * 0.44 * MS * SLIM;
        a.ry = cy + 0.36 * MS;
        a.L = 0.27 * MS;
        if (a.stage === "idle") {
          a.t = 0;
          a.hx = a.rx;
          a.hy = a.ry;
          a.cx = a.rx;
          a.cy = a.ry;
          a.ex = a.sx;
          a.ey = a.sy;
        }
      }
      if (key.mode === "home") {
        key.x = cx;
        key.y = cy;
      }
    }

    /* ---- guardian brain ---- */

    /**
     * Aim the swat away from the pointer, so the key is always knocked clear of
     * the visitor rather than towards them. Falls back to an upward shove when
     * the pointer sits exactly on the key (a zero-length vector).
     */
    function setDir() {
      if (!mouse) return;
      let dx = key.x - mouse.x;
      let dy = key.y - mouse.y;
      let d = Math.hypot(dx, dy);
      if (d < 4) {
        dx = key.x < cx ? -1 : 1;
        dy = -0.3;
        d = Math.hypot(dx, dy);
      }
      dir.x = dx / d;
      dir.y = dy / d;
    }

    /** Pick the claw that can actually reach the key, on the pointer's side. */
    function startSwat() {
      if (claimed) return;
      const reach = (a: Arm) =>
        Math.hypot(key.x - a.sx, key.y - a.sy) < 2 * a.L * 0.96;
      let a = mouse && mouse.x < key.x ? arms[0] : arms[1];
      if (!reach(a)) a = a === arms[0] ? arms[1] : arms[0];
      if (!reach(a) || a.stage !== "idle") return;
      setDir();
      a.stage = "windup";
      a.t = 0;
      a.hit = false;
      cool = COOLDOWN_FRAMES;
    }

    /** Knock the key loose: launch, spark, and shake. */
    function swat() {
      const sp = 0.032 * S;
      key.vx = dir.x * sp;
      key.vy = dir.y * sp - 0.012 * S;
      key.va = (Math.random() - 0.5) * 0.6;
      key.mode = "free";
      key.rest = 0;
      shake = reduced ? 0 : 0.02 * S;
      alertLevel = 1;
      // A swat ends a carry without going through onPointerUp, so the floating
      // key has to be retracted here too — otherwise it stays stuck under the
      // cursor with nothing driving it.
      hideGhost();
      pointerClient = null;
      for (let i = 0; i < 16; i++) {
        parts.push({
          x: key.x,
          y: key.y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10 - 2,
          l: 30,
        });
      }
    }

    /**
     * Two-bone IK. The target is clamped to the arm's maximum reach, then the
     * elbow angle is solved; of the two mirror solutions the one nearer the
     * body centre is kept so elbows never bend outward.
     */
    function ik(a: Arm, tx: number, ty: number) {
      let dx = tx - a.sx;
      let dy = ty - a.sy;
      let d = Math.hypot(dx, dy);
      const L = a.L;
      const max = 2 * L - 1;
      if (d > max) {
        dx *= max / d;
        dy *= max / d;
        d = max;
      }
      d = Math.max(d, 2);
      const an = Math.atan2(dy, dx);
      const A = Math.acos(
        Math.max(-1, Math.min(1, (d * d) / (2 * L * d))),
      );
      const e1 = { x: a.sx + Math.cos(an + A) * L, y: a.sy + Math.sin(an + A) * L };
      const e2 = { x: a.sx + Math.cos(an - A) * L, y: a.sy + Math.sin(an - A) * L };
      const m = { x: mx, y: my + 0.05 * S };
      const e =
        Math.hypot(e1.x - m.x, e1.y - m.y) > Math.hypot(e2.x - m.x, e2.y - m.y)
          ? e1
          : e2;
      a.ex = e.x;
      a.ey = e.y;
      a.cx = a.sx + dx;
      a.cy = a.sy + dy;
    }

    /** idle -> windup (telegraph) -> swipe (strike) -> recover -> idle. */
    function armUpdate(a: Arm) {
      let tx: number;
      let ty: number;
      let sp: number;

      if (a.stage === "idle") {
        tx = a.rx + Math.sin(t * 0.04 + a.side) * 0.012 * S;
        ty = a.ry + Math.cos(t * 0.05 + a.side) * 0.012 * S;
        sp = 0.07;
      } else if (a.stage === "windup") {
        // Pull back along the launch vector to telegraph the strike.
        tx = key.x - dir.x * 0.22 * S;
        ty = key.y - dir.y * 0.22 * S - 0.04 * S;
        sp = 0.28;
        if (++a.t >= 12) {
          a.stage = "swipe";
          a.t = 0;
          setDir();
        }
      } else if (a.stage === "swipe") {
        tx = key.x + dir.x * 0.16 * S;
        ty = key.y + dir.y * 0.16 * S;
        sp = 0.6;
        // One hit per swipe: test once, then flag so the rest of the arc is spent
        // travelling through rather than re-triggering.
        if (!a.hit && Math.hypot(a.cx - key.x, a.cy - key.y) < 0.1 * S) {
          a.hit = true;
          a.t = 8;
          swat();
        }
        if (++a.t >= 16) {
          a.stage = "recover";
          a.t = 0;
        }
      } else {
        tx = a.rx;
        ty = a.ry;
        sp = 0.1;
        if (++a.t >= 40) a.stage = "idle";
      }

      a.hx += (tx - a.hx) * sp;
      a.hy += (ty - a.hy) * sp;
      ik(a, a.hx, a.hy);
    }


    /* ---- key physics ---- */

    /**
     * Advance the key. The only way to win is to carry it out of this band and
     * drop it on the hero's cage, which is handled in onPointerUp — the sim just
     * keeps the key physical while it is being fought over.
     */
    function keyUpdate() {
      const k = key;
      const r = 0.05 * S;

      if (k.mode === "home") {
        k.x = cx;
        k.y = cy + Math.sin(t * 0.05) * 0.01 * S;
        k.a = Math.sin(t * 0.03) * 0.06;
      } else if (k.mode === "drag" && mouse) {
        const px = k.x;
        const py = k.y;
        k.x += (mouse.x + k.ox - k.x) * 0.4;
        k.y += (mouse.y + k.oy - k.y) * 0.4;
        // Pin the key to the canvas edge once the pointer leaves, so it reads as
        // pressed to the boundary while the ghost carries it onwards.
        k.x = Math.max(r, Math.min(W - r, k.x));
        k.y = Math.max(r, Math.min(H - r, k.y));
        // Derive velocity from the frame delta so a flick throws the key.
        k.vx = k.x - px;
        k.vy = k.y - py;
        k.a *= 0.9;
      } else if (k.mode === "return") {
        k.x += (cx - k.x) * 0.05;
        k.y += (cy - k.y) * 0.05;
        k.a *= 0.92;
        if (Math.hypot(k.x - cx, k.y - cy) < 3) k.mode = "home";
      } else if (k.mode === "claimed") {
        // Won: hang where it was claimed, glowing, while the guardian recoils.
        k.a *= 0.95;
      } else {
        k.mode = "free";
        k.vy += (GRAVITY * S) / 700;
        k.vx *= 0.997;
        k.x += k.vx;
        k.y += k.vy;
        k.a += k.va;
        // Walls: bounce with energy loss, and damp spin so it settles flat.
        if (k.x < r) {
          k.x = r;
          k.vx = -k.vx * 0.6;
          k.va *= -0.7;
        }
        if (k.x > W - r) {
          k.x = W - r;
          k.vx = -k.vx * 0.6;
          k.va *= -0.7;
        }
        if (k.y < r) {
          k.y = r;
          k.vy = Math.abs(k.vy) * 0.5;
        }
        if (k.y > H - r) {
          k.y = H - r;
          k.vy = -k.vy * 0.5;
          k.vx *= 0.92;
          k.va *= 0.85;
        }
        if (Math.hypot(k.vx, k.vy) < 0.8 && k.y > H - r - 2) {
          if (++k.rest > 150) {
            k.mode = "return";
            // Normalise the angle to -PI..PI so the fly-home never spins around.
            k.a = ((((k.a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) %
              (2 * Math.PI)) -
              Math.PI;
          }
        } else {
          k.rest = 0;
        }
      }
    }

    /** Win path, shared by the cage drop and the keyboard fallback button. */
    function claimKey() {
      if (claimed) return;
      claimed = true;
      key.mode = "claimed";
      key.vx = 0;
      key.vy = 0;
      key.va = 0;
      liveEl.textContent = "Containment broken. The vault key is yours.";
      onClaimRef.current();
    }

    /** True while the visitor is carrying the key. */
    function isDragging(): boolean {
      return key.mode === "drag";
    }

    /**
     * Hit-test the hero's cage against viewport coordinates.
     *
     * Deliberately strict: the test is the portrait element's own box, with no
     * padding or radius of forgiveness. A near miss is a miss, so the key has to
     * be released squarely on the cage for containment to break.
     */
    function overPortrait(clientX: number, clientY: number): boolean {
      const target = document.getElementById(PORTRAIT_ID);
      if (!target) return false;
      const b = target.getBoundingClientRect();
      return (
        clientX >= b.left &&
        clientX <= b.right &&
        clientY >= b.top &&
        clientY <= b.bottom
      );
    }

    /** Retract the floating key and clear the drop highlight. */
    function hideGhost() {
      const ghost = ghostRef.current;
      if (ghost) {
        ghost.style.opacity = "0";
        ghost.dataset.hot = "false";
      }
      setDropHot(false);
      // Hand the key back to the canvas: without this it would stay hidden
      // after a cancelled carry, since keyEscaped is only written mid-drag.
      keyEscaped = false;
    }

    /**
     * Publish the hover state. Called from the loop, so it must be a no-op
     * unless the value actually changed — this sits on React state, and the loop
     * runs every frame.
     */
    function setDropHot(hot: boolean) {
      if (hot === dropHot) return;
      dropHot = hot;
      onDropHotRef.current?.(hot);
    }

    /**
     * Mirror the carry into the DOM. Once the pointer leaves the canvas a
     * floating key takes over, so the key reads as physically carried out of this
     * section rather than simply vanishing at the edge.
     *
     * The cage is hit-tested every frame rather than on pointermove because its
     * rect moves while the page auto-scrolls. Dragging past the top edge pulls
     * the hero into view so the drop target is actually reachable.
     */
    function syncDragGhost() {
      const ghost = ghostRef.current;
      if (!ghost || !pointerClient) return;

      const box = cv.getBoundingClientRect();
      const outside =
        pointerClient.x < box.left ||
        pointerClient.x > box.right ||
        pointerClient.y < box.top ||
        pointerClient.y > box.bottom;

      // Half the ghost's 56px box (28px), so the key centres on the pointer.
      ghost.style.transform = `translate(${pointerClient.x - 28}px, ${
        pointerClient.y - 28
      }px)`;
      // Inside the band the real canvas key is already visible; showing the
      // ghost too would draw the key twice.
      ghost.style.opacity = outside ? "1" : "0";
      // Mirror the reverse: once the pointer leaves the band, drop the canvas
      // key so exactly one key is ever on screen.
      keyEscaped = outside;

      dropHot = overPortrait(pointerClient.x, pointerClient.y);
      ghost.dataset.hot = dropHot ? "true" : "false";

      if (outside && pointerClient.y < box.top && !scrolledForDrag) {
        scrolledForDrag = true;
        document.getElementById(PORTRAIT_ID)?.scrollIntoView({
          behavior: reduced ? "auto" : "smooth",
          block: "center",
        });
      }
    }

    function update() {
      // The frame counter drives every ambient oscillation (body wobble,
      // breathing, eye drift, idle arm sway). Freezing it under reduced motion
      // stills all of that at once while leaving the game itself fully playable.
      if (!reduced) t++;
      if (--blinkT < 0) {
        blink = 1;
        blinkT = 150 + Math.random() * 200;
      }
      blink = Math.max(0, blink - 0.12);

      const near =
        !!mouse && Math.hypot(mouse.x - key.x, mouse.y - key.y) < 0.17 * S;
      nearT = near ? nearT + 1 : 0;
      // Exponential smoothing keeps the glow from popping on/off.
      alertLevel += ((near ? 1 : 0) - alertLevel) * 0.1;
      if (cool > 0) cool--;

      // Reaction time before it strikes.
      if (near && nearT >= REACT_FRAMES && cool === 0) startSwat();

      keyUpdate();
      arms.forEach(armUpdate);

      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.l--;
      }
      // Filter in place to avoid reallocating a fresh array every frame.
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].l <= 0) parts.splice(i, 1);
      }

      if (claimed) defeat = Math.min(1, defeat + 0.01);
      shake *= 0.88;
      // Runs after physics so the ghost tracks this frame's key state.
      if (isDragging()) syncDragGhost();
    }


    /* ---- drawing ---- */

    /**
     * Smoky silhouette. Two out-of-phase sine harmonics wobble the radius
     * around the ellipse, so the body breathes without any sprite or asset.
     */
    function blob(x: number, y: number, rx: number, ry: number, amp: number, ph: number) {
      c.beginPath();
      for (let i = 0; i <= 48; i++) {
        const an = (i / 48) * Math.PI * 2;
        const w =
          1 +
          Math.sin(an * 6 + t * 0.05 + ph) * amp +
          Math.sin(an * 11 - t * 0.07) * amp * 0.5;
        const px = x + Math.cos(an) * rx * w;
        const py = y + Math.sin(an) * ry * w;
        if (i) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      c.closePath();
      c.fill();
    }

    /** Glowing eye whose pupil tracks the pointer, blinks, and dilates on alert. */
    function eye(ex: number, ey: number, rx: number, ry: number, sg: number) {
      const lx = mouse ? mouse.x : cx;
      const ly = mouse ? mouse.y : cy;
      const dx = lx - ex;
      const dy = ly - ey;
      const d = Math.hypot(dx, dy) || 1;
      const off = Math.min(rx * 0.35, d * 0.08);
      const bl = 1 - blink * 0.92;
      const r = 1 + alertLevel * 0.25;
      const rot = -sg * 0.35;

      c.save();
      c.shadowColor = "#ff1a1a";
      c.shadowBlur = 0.05 * S * (0.6 + alertLevel);
      c.fillStyle = EYE;
      c.beginPath();
      c.ellipse(ex, ey, rx * r, ry * bl * r, rot, 0, 7);
      c.fill();
      c.shadowColor = "transparent";
      c.fillStyle = "#ffb09a";
      c.beginPath();
      c.ellipse(
        ex + (dx / d) * off,
        ey + (dy / d) * off,
        rx * 0.4,
        ry * 0.5 * bl,
        rot,
        0,
        7,
      );
      c.fill();
      c.restore();
    }

    /** Quadratic Bézier sampler used to place fangs along the mouth curves. */
    function quad(
      a: { x: number; y: number },
      c: { x: number; y: number },
      b: { x: number; y: number },
      u: number,
    ): { x: number; y: number } {
      const v = 1 - u;
      return {
        x: v * v * a.x + 2 * v * u * c.x + u * u * b.x,
        y: v * v * a.y + 2 * v * u * c.y + u * u * b.y,
      };
    }


    function monster() {
      const br = 1 + Math.sin(t * 0.03) * 0.01;
      // Shake jitters the whole body; alert adds a constant tremble.
      const jitter = shake + alertLevel * 2;
      const sx = (Math.random() - 0.5) * jitter;
      const sy = (Math.random() - 0.5) * jitter;
      // Post-win the guardian sinks and fades out.
      const drop = defeat * 0.3 * MS;
      const fade = 1 - defeat * 0.75;

      c.save();
      c.globalAlpha = fade;
      c.translate(mx + sx, my + sy + drop);
      // Thin: squeeze x around the body centre. The blobs, eyes, and mouth
      // all draw relative to mx, so one scale thins the whole silhouette.
      c.scale(br * SLIM, br);
      c.translate(-mx, -(my + drop));
      c.fillStyle = BODY;
      blob(mx, my + 0.22 * MS, 0.5 * MS, 0.4 * MS, 0.03, 0);
      blob(mx, my - 0.3 * MS, 0.33 * MS, 0.3 * MS, 0.025, 2);
      eye(mx - 0.13 * MS, my - 0.37 * MS, 0.06 * MS, 0.03 * MS, -1);
      eye(mx + 0.13 * MS, my - 0.37 * MS, 0.06 * MS, 0.03 * MS, 1);

      // Mouth: dark red interior between two opposing curves, fanged.
      const x0 = mx - 0.21 * MS;
      const x1 = mx + 0.21 * MS;
      const y0 = my - 0.21 * MS;
      const open =
        0.035 * MS + alertLevel * 0.07 * MS + Math.sin(t * 0.03) * 0.004 * MS;
      const up = { x: mx, y: y0 + 0.04 * MS };
      const lo = { x: mx, y: y0 + 0.04 * MS + 2 * open };

      c.fillStyle = "#4a0008";
      c.beginPath();
      c.moveTo(x0, y0);
      c.quadraticCurveTo(up.x, up.y, x1, y0);
      c.quadraticCurveTo(lo.x, lo.y, x0, y0);
      c.fill();

      c.fillStyle = "#eee7d6";
      const P0 = { x: x0, y: y0 };
      const P1 = { x: x1, y: y0 };
      // Upper fangs point down; the middle pair is drawn longer, like canines.
      for (let i = 0; i < 9; i++) {
        const p = quad(P0, up, P1, (i + 0.5) / 9);
        const w = 0.016 * MS;
        const h = i === 1 || i === 7 ? 0.06 * MS : 0.032 * MS;
        c.beginPath();
        c.moveTo(p.x - w, p.y);
        c.lineTo(p.x + w, p.y);
        c.lineTo(p.x, p.y + h);
        c.fill();
      }
      // Lower fangs point up.
      for (let i = 0; i < 8; i++) {
        const p = quad(P0, lo, P1, (i + 0.5) / 8);
        const w = 0.015 * MS;
        const h = i === 2 || i === 5 ? 0.05 * MS : 0.026 * MS;
        c.beginPath();
        c.moveTo(p.x - w, p.y);
        c.lineTo(p.x + w, p.y);
        c.lineTo(p.x, p.y - h);
        c.fill();
      }
      c.restore();
    }

    /**
     * The key itself. Once containment is broken it keeps a victory halo where it
     * was dropped.
     */
    function drawKey() {
      const k = key;
      // Fixed pixel size matching the drag ghost outside the section (56px
      // box, 20-unit viewBox): one unit = 2.8px. Same bow, shaft, and teeth
      // numbers as the ghost SVG, so the two read as one key. Physics and
      // grab radius keep full S — only the drawing shrinks.
      const u = 56 / 20;
      const L = 17 * u;
      const r = 3.4 * u;
      const th = 1.2 * u;
      const bx = -L / 2 + r;

      c.save();
      c.translate(k.x, k.y);
      c.rotate(k.a);
      c.shadowColor = "rgba(255,200,80,.85)";
      c.shadowBlur = 10 * (0.6 + alertLevel * 0.6 + defeat);
      const grad = c.createLinearGradient(0, -r, 0, r);
      grad.addColorStop(0, GOLD_HI);
      grad.addColorStop(0.5, GOLD_MID);
      grad.addColorStop(1, GOLD_LO);
      c.strokeStyle = grad;
      c.fillStyle = grad;
      c.lineCap = "round";

      // Bow: an outer ring and an inner ring, both stroked.
      c.lineWidth = th * 1.3;
      c.beginPath();
      c.arc(bx, 0, r, 0, 7);
      c.stroke();
      c.lineWidth = th;
      c.beginPath();
      c.arc(bx, 0, r * 0.35, 0, 7);
      c.stroke();

      // Shaft.
      c.lineWidth = th;
      c.beginPath();
      c.moveTo(bx + r, 0);
      c.lineTo(L / 2, 0);
      c.stroke();

      // Two teeth as filled rectangles.
      c.fillRect(L / 2 - th * 3, 0, th * 1.3, th * 3.2);
      c.fillRect(L / 2 - th * 5.5, 0, th * 1.3, th * 2.2);
      c.restore();

      if (claimed) {
        // Victory halo.
        c.save();
        c.translate(k.x, k.y);
        c.strokeStyle = GOLD_HI;
        c.lineWidth = th;
        c.globalAlpha = 0.6 + Math.sin(t * 0.1) * 0.3;
        c.beginPath();
        c.arc(0, 0, L * 0.7, 0, 7);
        c.stroke();
        c.restore();
      }
    }


    /** Upper arm + forearm + claw knuckle + four long curved wolf claws. */
    function drawArm(a: Arm) {
      c.lineCap = "round";
      c.fillStyle = BODY;
      c.strokeStyle = BODY;
      c.lineWidth = 0.085 * MS * SLIM;
      c.beginPath();
      c.moveTo(a.sx, a.sy);
      c.lineTo(a.ex, a.ey);
      c.stroke();
      c.lineWidth = 0.06 * MS * SLIM;
      c.beginPath();
      c.moveTo(a.ex, a.ey);
      c.lineTo(a.cx, a.cy);
      c.stroke();
      c.beginPath();
      c.arc(a.cx, a.cy, 0.045 * MS * SLIM, 0, 7);
      c.fill();

      const dr = Math.atan2(a.cy - a.ey, a.cx - a.ex);
      c.fillStyle = "#e9e2d0";
      c.strokeStyle = "#2a2230";
      c.lineWidth = 1.2;
      for (const o of [-0.7, -0.23, 0.23, 0.7]) {
        const an = dr + o;
        const bx = a.cx + Math.cos(an) * 0.035 * MS;
        const by = a.cy + Math.sin(an) * 0.035 * MS;
        const tx = a.cx + Math.cos(an) * 0.2 * MS + Math.cos(dr) * 0.03 * MS;
        const ty = a.cy + Math.sin(an) * 0.2 * MS + Math.sin(dr) * 0.03 * MS;
        // Perpendicular offset gives each claw a hollow, curved outline.
        const nx = -Math.sin(an) * 0.009 * MS;
        const ny = Math.cos(an) * 0.009 * MS;
        const mx2 = (bx + tx) / 2 + Math.cos(dr) * 0.04 * MS;
        const my2 = (by + ty) / 2 + Math.sin(dr) * 0.04 * MS;
        c.beginPath();
        c.moveTo(bx + nx, by + ny);
        c.quadraticCurveTo(mx2 + nx * 0.3, my2 + ny * 0.3, tx, ty);
        c.quadraticCurveTo(mx2 - nx * 0.3, my2 - ny * 0.3, bx - nx, by - ny);
        c.closePath();
        c.fill();
        c.stroke();
      }
    }

    function draw() {
      // Clear only. The monster sits directly on the page background — no haze
      // wash — so the scene inherits the site's light/dark theme.
      c.clearRect(0, 0, W, H);

      monster();
      // The DOM ghost carries the key once it leaves the band; drawing the
      // canvas copy too would show two keys at once. Once claimed, the key
      // belongs to the cage, so it is gone from here for good.
      if (!keyEscaped && !claimed) drawKey();
      arms.forEach(drawArm);

      c.fillStyle = accent;
      for (const p of parts) {
        c.globalAlpha = p.l / 30;
        c.beginPath();
        c.arc(p.x, p.y, 3, 0, 7);
        c.fill();
      }
      c.globalAlpha = 1;
    }


    /* ---- loop ---- */

    /**
     * Fixed-timestep loop. Simulation frames are consumed in whole FRAME_MS
     * chunks so physics are frame-rate independent, while drawing happens once
     * per animation frame. The 100ms clamp prevents a huge catch-up burst after
     * the tab has been backgrounded.
     */
    function frame(ts: number) {
      raf = requestAnimationFrame(frame);
      // Idle when off-screen or the tab is hidden — but never mid-carry: the page
      // auto-scrolls the hero into view during a drag, which can push this band
      // out of the viewport while the visitor is still holding the key.
      if ((!visible || document.hidden) && !isDragging()) {
        last = ts;
        return;
      }
      acc += Math.min(ts - last, 100);
      last = ts;
      while (acc >= FRAME_MS) {
        update();
        acc -= FRAME_MS;
      }
      draw();
    }

    /* ---- input ---- */

    /** Translate a pointer event into cv-local coordinates. */
    function pos(e: PointerEvent): { x: number; y: number } {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function onPointerMove(e: PointerEvent) {
      mouse = pos(e);
      pointerClient = { x: e.clientX, y: e.clientY };
      const grabbing = key.mode === "drag";
      const near = Math.hypot(mouse.x - key.x, mouse.y - key.y) < GRAB_RADIUS * S;
      // While carrying, reflect the drop state in the cursor too.
      cv.style.cursor = grabbing
        ? dropHot
          ? "copy"
          : "grabbing"
        : near
          ? "grab"
          : "default";
    }

    function onPointerDown(e: PointerEvent) {
      mouse = pos(e);
      pointerClient = { x: e.clientX, y: e.clientY };
      if (Math.hypot(mouse.x - key.x, mouse.y - key.y) < GRAB_RADIUS * S) {
        key.mode = "drag";
        // Remember the grab offset so the key keeps its position relative to
        // the cursor instead of snapping its centre under it.
        key.ox = key.x - mouse.x;
        key.oy = key.y - mouse.y;
        // Fresh carry: allow the hero to be pulled into view again.
        scrolledForDrag = false;
        dropHot = false;
        cv.setPointerCapture(e.pointerId);
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (key.mode === "drag") {
        // Dropped on the hero's cage: containment breaks.
        if (overPortrait(e.clientX, e.clientY)) {
          hideGhost();
          pointerClient = null;
          claimKey();
          if (e.pointerType !== "mouse") mouse = null;
          return;
        }
        key.mode = "free";
        key.rest = 0;
      }
      hideGhost();
      pointerClient = null;
      // Touch/pen have no hover: stop tracking once the contact lifts, so the
      // guardian stops staring at a finger that is no longer on screen.
      if (e.pointerType !== "mouse") mouse = null;
    }

    function onPointerLeave(e: PointerEvent) {
      if (e.pointerType === "mouse" && key.mode !== "drag") mouse = null;
    }

    /* ---- wiring ---- */

    claimRef.current = claimKey;

    const onMotionChange = (e: MediaQueryListEvent) => {
      reduced = e.matches;
    };
    const onVisibility = () => {
      // Reset the clock so no catch-up burst is queued on return.
      last = performance.now();
      acc = 0;
    };

    layout();
    draw();

    const ro = new ResizeObserver(() => {
      layout();
      draw();
    });
    ro.observe(stage);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        onVisibility();
      },
      { threshold: 0 },
    );
    io.observe(stage);

    cv.addEventListener("pointermove", onPointerMove);
    cv.addEventListener("pointerdown", onPointerDown);
    cv.addEventListener("pointerup", onPointerUp);
    cv.addEventListener("pointercancel", onPointerUp);
    cv.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    motionQuery.addEventListener("change", onMotionChange);

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      cv.removeEventListener("pointermove", onPointerMove);
      cv.removeEventListener("pointerdown", onPointerDown);
      cv.removeEventListener("pointerup", onPointerUp);
      cv.removeEventListener("pointercancel", onPointerUp);
      cv.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      motionQuery.removeEventListener("change", onMotionChange);
      claimRef.current = null;
    };
  }, []);


  return (
    /*
     * Full-bleed band rather than a framed card: the guardian looms out of his
     * own murk, sized off the viewport height so he reads as an environment the
     * visitor steps into. The canvas itself is width-capped so the key stays
     * reachable on ultra-wide screens.
     *
     * No background of its own — the monster is drawn straight onto the page
     * background, so he inherits the site's light/dark theme instead of sitting
     * in a violet pool.
     */
    <div className={cn("relative isolate w-full", className)}>
      <div
        ref={stageRef}
        className="relative isolate mx-auto h-[62vh] min-h-[420px] w-full max-w-6xl sm:h-[70vh]"
      >
        {/*
          The canvas is the interactive surface. It carries a role/aria-label
          because it conveys meaning, and touch-action:none so dragging the key
          never scrolls the page on touch devices.
        */}
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="A shadow guardian clutching a golden key. Grab the key and drag it out of this section, up to the portrait cage, to break containment."
          className="block h-full w-full touch-none"
        />

        {/* Announcements for the win. */}
        <p ref={liveRef} aria-live="polite" className="sr-only" />
      </div>

      {/*
        Floating key. Hidden until the pointer is dragged out of the canvas, at
        which point it takes over so the key reads as physically carried out of
        this section. Fixed + inset-0 with a translate() mapping straight to
        client coordinates; pointer-events-none so it never eats the drag.
      */}
      <div
        ref={ghostRef}
        aria-hidden="true"
        data-ghost="key"
        data-hot="false"
        className="pointer-events-none fixed left-0 top-0 z-[100] h-14 w-14 opacity-0 transition-opacity duration-150 data-[hot=true]:scale-110"
      >
        {/*
          The carried key. This is the SAME design as the one drawn on the
          canvas, redrawn as SVG so it can leave the canvas element — same bow
          proportions, same two teeth, same gold gradient, same glow. Keeping a
          second, different key shape here made the portfolio read as two keys.
        */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="-10 -5 20 10"
          className="h-14 w-14 drop-shadow-[0_0_10px_rgba(255,200,80,0.85)]"
        >
          <defs>
            {/* Matches the canvas key's vertical three-stop gold ramp. */}
            <linearGradient
              id="key-guardian-gold"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="-3.4"
              x2="0"
              y2="3.4"
            >
              <stop offset="0" stopColor="#fff0a8" />
              <stop offset="0.5" stopColor="#d9a52b" />
              <stop offset="1" stopColor="#7a5410" />
            </linearGradient>
          </defs>

          {/* Bow: an outer ring and an inner ring, both stroked. */}
          <g
            fill="none"
            stroke="url(#key-guardian-gold)"
            strokeLinecap="round"
          >
            <circle cx="-5.1" cy="0" r="3.4" strokeWidth="1.56" />
            <circle cx="-5.1" cy="0" r="1.19" strokeWidth="1.2" />
            {/* Shaft. */}
            <path d="M -1.7 0 H 8.5" strokeWidth="1.2" />
          </g>

          {/* Two teeth, filled. */}
          <g fill="url(#key-guardian-gold)">
            <rect x="4.9" y="0" width="1.56" height="3.84" />
            <rect x="1.9" y="0" width="1.56" height="2.64" />
          </g>
        </svg>
      </div>

      {/*
        Escape hatch: the game is a pointer-only interaction, so a real button
        gives keyboard and switch users the same outcome.
      */}
    </div>
  );
}

