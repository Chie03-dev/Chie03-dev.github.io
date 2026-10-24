"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/*
 * The Vault Key -an interactive guardian mini-game rendered on a single
 * <canvas>, no libraries.
 *
 * A shadow guardian clutches a golden key. The visitor grabs the key and carries
 * it out of this band, up to the hero's containment cage, and drops it there to
 * break containment. The guardian swats to knock the key loose along the way, so
 * the carry has to be won -and the drop has to land squarely on the cage.
 *
 * Two portability choices keep it cheap and responsive:
 *  - The simulation steps on a fixed 60Hz timestep decoupled from paint, so
 *    physics stay identical regardless of display refresh rate.
 *  - Every dimension is a fraction of `S = min(width, height)`, so a single
 *    code path scales to any box with no breakpoints.
 *
 * It pauses entirely when scrolled out of view or the tab is hidden -except
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

/* ---- pixel art assets ---- */

const VW = 22; // main sprite width, in pixels

const PAL: Record<string, string> = {
  O: "#120d0a", // outline
  h: "#a8873f", H: "#c9a85a", d: "#5f4a24", // straw
  r: "#5c1616", // hat band (dried blood red)
  s: "#c8977a", S: "#9a6b52", // skin
  b: "#3b281b", // hair / beard
  t: "#463629", T: "#5a4634", p: "#7d6034", // tunic, highlight, strap
};

/** Rows are centred, so only the content is written (no padding). */
const VILLAGER: string[] = [
  "O".repeat(8),
  "O" + "hhHHhhhh" + "O",
  "O" + "hhHHHhhhhh" + "O",
  "O" + "hhhhhhhhhd" + "O",
  "O" + "r".repeat(10) + "O",
  "O" + "r".repeat(10) + "O",
  "O" + "hhhhhhhhHHhhhhhhhhdd" + "O", // brim
  "O" + "d".repeat(20) + "O", // brim shadow
  "O" + "b" + "S".repeat(10) + "b" + "O", // 8  forehead shadow
  "O" + "b" + "s".repeat(10) + "b" + "O", // 9  brows
  "O" + "b" + "s".repeat(10) + "b" + "O", // 10 eyes
  "O" + "b" + "s".repeat(10) + "b" + "O", // 11 eyes
  "O" + "b" + "ssss" + "SS" + "ssss" + "b" + "O", // 12 nose
  "O" + "b".repeat(12) + "O", // 13 moustache
  "O" + "b".repeat(12) + "O", // 14 beard + mouth
  "O" + "b".repeat(10) + "O", // 15
  "O" + "b".repeat(8) + "O", // 16
  "O".repeat(8), // 17
  "O" + "TT" + "t".repeat(16) + "TT" + "O", // shoulders
  "O" + "ttpp" + "t".repeat(16) + "O",
  "O" + "tttt" + "pp" + "t".repeat(14) + "O", // repeats down to the floor
];

/* Background crowd: smaller, darker, eerie pale eyes (E). */
const BG_PAL: Record<string, string> = {
  O: "#0a0707",
  h: "#6e5a2e", r: "#3d0f0f",
  s: "#8a6652", b: "#241810",
  k: "#1d1915", // hood
  t: "#2b2119", T: "#362a20",
  E: "#f3e6b0",
};

const CROWD_BODY = ["O" + "T" + "t".repeat(8) + "T" + "O", "O" + "t".repeat(10) + "O"];
const CROWD_STRAW = [
  "O".repeat(6),
  "O" + "hhhhhh" + "O",
  "O" + "r".repeat(6) + "O",
  "O" + "h".repeat(10) + "O",
  "O" + "bsEssEsb" + "O",
  "O" + "b" + "s".repeat(6) + "b" + "O",
  "O" + "b".repeat(8) + "O",
  "O" + "b".repeat(6) + "O",
  ...CROWD_BODY,
];
const CROWD_HOOD = [
  "O".repeat(6),
  "O" + "k".repeat(6) + "O",
  "O" + "k".repeat(8) + "O",
  "O" + "kk" + "s".repeat(6) + "kk" + "O",
  "O" + "ksEssEsk" + "O",
  "O" + "k" + "s".repeat(6) + "k" + "O",
  "O" + "k".repeat(8) + "O",
  "O" + "k".repeat(6) + "O",
  ...CROWD_BODY,
];

/** x is a fraction of the canvas width. They only bob; nothing else moves. */
const CROWD = [
  { x: 0.05, back: true, hood: true, torch: false, side: 1, ph: 0.0 },
  { x: 0.15, back: false, hood: false, torch: true, side: -1, ph: 1.3 },
  { x: 0.27, back: true, hood: false, torch: false, side: 1, ph: 2.1 },
  { x: 0.73, back: true, hood: false, torch: true, side: -1, ph: 0.7 },
  { x: 0.85, back: false, hood: true, torch: false, side: 1, ph: 2.8 },
  { x: 0.95, back: true, hood: false, torch: false, side: -1, ph: 1.9 },
];



/** Draw a character-map sprite. The last row repeats down to `bottom`. */
function drawSprite(
  c: CanvasRenderingContext2D,
  rows: string[],
  pal: Record<string, string>,
  ox: number,
  oy: number,
  width: number,
  p: number,
  bottom: number,
) {
  rows.forEach((row, r) => {
    const off = (width - row.length) / 2;
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(Math.round(ox + (off + i) * p), oy + r * p, p, p);
    }
  });
  const last = rows[rows.length - 1];
  const off = (width - last.length) / 2;
  const y = oy + rows.length * p;
  if (bottom <= y) return;
  for (let i = 0; i < last.length; i++) {
    const col = pal[last[i]];
    if (!col) continue;
    c.fillStyle = col;
    c.fillRect(Math.round(ox + (off + i) * p), y, p, bottom - y);
  }
}

export interface KeyGuardianProps {
  /** Fired when containment breaks -by dropping the key on the cage. */
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

    const GOLD_HI = "#fff0a8";
    const GOLD_MID = "#d9a52b";
    const GOLD_LO = "#7a5410";


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
    /** Pixel size. One grid for every sprite, derived from the monster scale. */
    let PX = 4;
    /** Night backdrop behind the scene. Set false to inherit the page background. */
    const BACKDROP = true;
    /**
     * Guardian body scale. The monster reads oversized next to the key game,
     * so the body, arms, and eyes draw at 70% while the key, grab radius, and
     * alert distances keep full scale -the game stays exactly as playable.
     */
    const MONSTER = 0.7;
    /**
     * Horizontal squeeze applied to the body silhouette, eyes, mouth, and arm
     * anchors. Only widths slim -heights stay full so he reads thinner, not
     * shorter.
     */
    const SLIM = 0.62;
    let cx = 0;
    let cy = 0;
    /** Guardian body centre -sits just below the key's home position. */
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
     * span -otherwise a second key is visible sitting back on the pedestal.
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
      PX = Math.max(3, Math.round(MS * 0.02));
      cx = W / 2;
      cy = H / 2;
      mx = cx;
      my = cy + 0.2 * S;

      for (const a of arms) {
        a.sx = cx + a.side * 0.3 * MS * SLIM;
        a.sy = cy + 0.14 * MS;
        // Rest pose raises the hands out and above the shoulders so the arms
        // read long and bent, spread away from the gaunt torso, rather than
        // hanging tucked against it. This is deliberately done with the POSE
        // and not the bone length: L drives both the IK clamp and the swat's
        // reach test, and lengthening it lets the guardian strike a key that
        // is already being carried away, which makes the game unwinnable
        // (measured: 0/5 wins versus 5/5 at the original length).
        a.rx = cx + a.side * 0.62 * MS * SLIM;
        a.ry = cy - 0.16 * MS;
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
      // The pitchfork arm (right) always takes the swing if it can reach;
      // the bare fist only helps when the key is out of its range.
      let a = arms[1];
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
      // key has to be retracted here too -otherwise it stays stuck under the
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
     * drop it on the hero's cage, which is handled in onPointerUp -the sim just
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
     * unless the value actually changed -this sits on React state, and the loop
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






    function monster() {
      const p = PX;
      const snap = (v: number) => Math.round(v / p) * p;
      const bob = Math.round(Math.sin(t * 0.035) * 0.6) * p;
      const jit = alertLevel * 1.2 + shake / p;
      const jx = Math.round((Math.random() - 0.5) * jit) * p;
      const jy = Math.round((Math.random() - 0.5) * jit) * p;
      const drop = snap(defeat * 0.3 * MS);
      const ox = snap(mx - (VW * p) / 2) + jx;
      const oy = snap(cy - 0.07 * S) - 18 * p + bob + jy + drop;

      c.save();
      c.globalAlpha = 1 - defeat * 0.75;
      drawSprite(c, VILLAGER, PAL, ox, oy, VW, p, H);

      const R = (col: number, row: number, w: number, h: number, color: string) => {
        c.fillStyle = color;
        c.fillRect(ox + col * p, oy + row * p, w * p, h * p);
      };

      const ex = ox + 11 * p;
      const ey = oy + 10.5 * p;
      const gx = mouse ? (mouse.x < ex - 0.03 * S ? -1 : mouse.x > ex + 0.03 * S ? 1 : 0) : 0;
      const gy = mouse && mouse.y < ey - 0.02 * S ? 0 : 1;
      const pupil = alertLevel > 0.5 ? "#b3130f" : "#120d0a";

      for (const col of [7, 12]) {
        if (blink > 0.5) {
          R(col, 11, 3, 1, "#120d0a");
        } else {
          R(col, 10, 3, 2, "#e9e2cf");
          R(col + 1 + gx, 10 + gy, 1, 1, pupil);
        }
      }

      const angry = alertLevel > 0.4;
      R(7, 9, 2, 1, "#241810");
      R(9, angry ? 10 : 9, 1, 1, "#241810");
      R(12, angry ? 10 : 9, 1, 1, "#241810");
      R(13, 9, 2, 1, "#241810");

      if (alertLevel > 0.4) {
        R(9, 14, 4, 1, "#d9d2bd");
        R(9, 15, 4, 1, "#2a0a0a");
      } else {
        R(10, 14, 2, 1, "#2a0a0a");
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
      // grab radius keep full S -only the drawing shrinks.
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


    /**
     * Pixel sleeve + fist. The right arm (side 1) also carries the pitchfork.
     */
    /** Night sky in hard colour bands, plus a pixel moon. */
function backdrop() {
  const p = PX;
  const mxp = Math.round((W * 0.82) / p) * p;
  const myp = Math.round((H * 0.16) / p) * p;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (Math.hypot(dx, dy) > 4.2) continue;
      const crater = (dx === -1 && dy === -1) || (dx === 1 && dy === 1);
      c.fillStyle = crater ? "#a8a28a" : "#cfc8ae";
      c.fillRect(mxp + dx * p, myp + dy * p, p, p);
    }
  }
}

    /** Blocky torch light: three alpha bands on the pixel grid. */
    function glow(gx: number, gy: number) {
      const p = PX;
      c.fillStyle = "#ff9a3c";
      for (let dy = -6; dy <= 6; dy++) {
        for (let dx = -6; dx <= 6; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > 6) continue;
          c.globalAlpha = d <= 3 ? 0.14 : d <= 5 ? 0.07 : 0.035;
          c.fillRect(gx + dx * p, gy + dy * p, p, p);
        }
      }
      c.globalAlpha = 1;
    }

    /** The mob behind him. They only bob up and down; torches flicker. */
    function crowd() {
      const p = PX;
      for (const pass of [true, false]) {
        for (const v of CROWD) {
          if (v.back !== pass) continue;
          const bob = Math.round(Math.sin(t * 0.05 + v.ph) * 1.2) * p;
          const bx = Math.round((v.x * W) / p) * p;
          const top = Math.round((cy - (v.back ? 0.05 : -0.07) * S) / p) * p + bob;
          const hx = bx + v.side * 5 * p;
          const ty = top - 4 * p;

          if (v.torch) glow(hx, ty - p);

          drawSprite(c, v.hood ? CROWD_HOOD : CROWD_STRAW, BG_PAL, bx - 6 * p, top, 12, p, H);

          c.fillStyle = "#5b4126";
          if (v.torch) {
            c.fillRect(hx, ty, p, H - ty);
            c.fillStyle = "#2a1d12";
            c.fillRect(hx - p, ty, 3 * p, 2 * p);
            const fl = 2 + Math.round(Math.sin(t * 0.3 + v.ph * 3) + 1); // 2..4
            c.fillStyle = "#c2410c";
            c.fillRect(hx - p, ty - fl * p, 3 * p, fl * p);
            c.fillStyle = "#ffd25a";
            c.fillRect(hx, ty - (fl - 1) * p, p, (fl - 1) * p);
          } else {
            const fy = top - 5 * p;
            c.fillRect(hx, fy + 4 * p, p, H - (fy + 4 * p));
            c.fillStyle = "#8c9296";
            c.fillRect(hx - 2 * p, fy, p, 3 * p);
            c.fillRect(hx, fy - p, p, 4 * p);
            c.fillRect(hx + 2 * p, fy, p, 3 * p);
            c.fillRect(hx - 2 * p, fy + 3 * p, 5 * p, p);
          }
          c.fillStyle = BG_PAL.s;
          c.fillRect(hx - p, top + 8 * p, 3 * p, 2 * p);
        }
      }
    }

    function drawArm(a: Arm) {
      const p = PX;
      const M = MS;
      const EDGE = "#120d0a";
      const SLEEVE = "#5a4634";
      const SKIN = "#c8977a";
      const fork = a.side === 1;

      const ang = Math.atan2(a.cy - a.sy, a.cx - a.sx);
      const ux = Math.cos(ang);
      const uy = Math.sin(ang);
      const nx = -uy;
      const ny = ux;
      const tw = 2 * p;
      const bx = a.cx + ux * 0.04 * M;
      const by = a.cy + uy * 0.04 * M;
      const bax = a.cx - ux * 0.3 * M;
      const bay = a.cy - uy * 0.3 * M;
      const tines = [-1, 0, 1].map((o) => ({
        x: bx + nx * tw * o,
        y: by + ny * tw * o,
        len: (o === 0 ? 0.11 : 0.095) * M,
      }));

      c.save();
      c.globalAlpha = 1 - defeat * 0.75;

      function pixLine(x0: number, y0: number, x1: number, y1: number, w: number, color: string) {
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / p));
        const h = Math.floor(w / 2) * p;
        c.fillStyle = color;
        for (let i = 0; i <= n; i++) {
          const x = Math.round((x0 + ((x1 - x0) * i) / n) / p) * p - h;
          const y = Math.round((y0 + ((y1 - y0) * i) / n) / p) * p - h;
          c.fillRect(x, y, w * p, w * p);
        }
      }

      pixLine(a.sx, a.sy, a.ex, a.ey, 5, EDGE);
      pixLine(a.ex, a.ey, a.cx, a.cy, 5, EDGE);
      if (fork) {
        pixLine(bax, bay, bx, by, 3, EDGE);
        pixLine(bx - nx * tw, by - ny * tw, bx + nx * tw, by + ny * tw, 3, EDGE);
        for (const tn of tines) {
          pixLine(tn.x, tn.y, tn.x + ux * tn.len, tn.y + uy * tn.len, 3, EDGE);
        }
      }

      pixLine(a.sx, a.sy, a.ex, a.ey, 3, SLEEVE);
      pixLine(a.ex, a.ey, a.cx, a.cy, 3, SLEEVE);
      if (fork) {
        pixLine(bax, bay, bx, by, 1, "#6b4a2a");
        pixLine(bx - nx * tw, by - ny * tw, bx + nx * tw, by + ny * tw, 1, "#8c9296");
        for (const tn of tines) {
          pixLine(tn.x, tn.y, tn.x + ux * tn.len, tn.y + uy * tn.len, 1, "#8c9296");
        }
      }

      pixLine(a.cx, a.cy, a.cx, a.cy, 5, EDGE);
      pixLine(a.cx, a.cy, a.cx, a.cy, 3, SKIN);
      c.restore();
    }

    function draw() {
      c.clearRect(0, 0, W, H);
      if (BACKDROP) backdrop();
      crowd();
      monster();
      if (!keyEscaped && !claimed) drawKey();
      arms.forEach(drawArm);

      c.fillStyle = accent;
      for (const q of parts) {
        c.globalAlpha = q.l / 30;
        c.fillRect(Math.round(q.x / PX) * PX, Math.round(q.y / PX) * PX, PX, PX);
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
      // Idle when off-screen or the tab is hidden -but never mid-carry: the page
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
     * No background of its own -the monster is drawn straight onto the page
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
          aria-label="A cartoon villager in a straw hat with a pitchfork, guarding a golden key. Grab the key and drag it out of this section, up to the portrait cage, to break containment."
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
        // `group` so the carried key's own hot-state scale can hang off the
        // child SVG. Scaling the positioned wrapper itself would be wrong: this
        // element is moved by an inline translate() every frame, and a scale on
        // the same element resolves its transform-origin against the wrapper's
        // layout box (pinned at the viewport's top-left), so the hot state
        // shoved the key off the cursor by ~10% of the pointer's position.
        className="pointer-events-none group fixed left-0 top-0 z-[100] h-14 w-14 opacity-0 transition-opacity duration-150"
      >
        {/*
          The carried key. This is the SAME design as the one drawn on the
          canvas, redrawn as SVG so it can leave the canvas element -same bow
          proportions, same two teeth, same gold gradient, same glow. Keeping a
          second, different key shape here made the portfolio read as two keys.
        */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="-10 -5 20 10"
          className="h-14 w-14 drop-shadow-[0_0_10px_rgba(255,200,80,0.85)] transition-transform duration-150 group-data-[hot=true]:scale-110"
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

