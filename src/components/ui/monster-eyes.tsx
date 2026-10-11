"use client";

import { useEffect, useRef, useState } from "react";
import { useHeroLock } from "@/context/hero-lock-context";

/**
 * Interactive monster eyes with reaching claws that react to the key.
 * Tracks pointer proximity and triggers a "swat" animation when the key gets too close.
 * The pupils smoothly follow the cursor, and the whole monster drifts/blinks via CSS.
 * All ambient motion is CSS-driven; swat and pupil offsets are applied via inline style.
 */
export function MonsterEyes() {
  const { isKeyDragging } = useHeroLock();
  const containerRef = useRef<HTMLDivElement>(null);
  const leftArmRef = useRef<HTMLDivElement>(null);
  const rightArmRef = useRef<HTMLDivElement>(null);
  const leftEyeRef = useRef<HTMLSpanElement>(null);
  const rightEyeRef = useRef<HTMLSpanElement>(null);
  const [swatState, setSwatState] = useState<{
    left: { x: number; y: number; rot: number } | null;
    right: { x: number; y: number; rot: number } | null;
  }>({ left: null, right: null });
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const lastSwatRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const SWAT_COOLDOWN = 1000;

  // Swat the claws when the dragged ghost key gets too close.
  useEffect(() => {
    if (!isKeyDragging) return;

    const container = containerRef.current;
    const leftArm = leftArmRef.current;
    const rightArm = rightArmRef.current;
    if (!container || !leftArm || !rightArm) return;

    const getGhostPos = (): { x: number; y: number } | null => {
      const ghost = document.querySelector(
        '[data-ghost="key"]'
      ) as HTMLElement | null;
      if (!ghost) return null;
      const rect = ghost.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };

    const handlePointerMove = () => {
      const ghostPos = getGhostPos();
      if (!ghostPos) return;

      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.left + containerRect.width / 2;
      const centerY = containerRect.top + containerRect.height / 2;

      const LEFT_ARM_X = centerX - 200;
      const RIGHT_ARM_X = centerX + 200;
      const ARM_Y = centerY;

      const dxLeft = ghostPos.x - LEFT_ARM_X;
      const dyLeft = ghostPos.y - ARM_Y;
      const distLeft = Math.hypot(dxLeft, dyLeft);

      const dxRight = ghostPos.x - RIGHT_ARM_X;
      const dyRight = ghostPos.y - ARM_Y;
      const distRight = Math.hypot(dxRight, dyRight);

      const SWAT_RADIUS = 140;
      const now = Date.now();

      if (distLeft < SWAT_RADIUS && now - lastSwatRef.current.left > SWAT_COOLDOWN) {
        lastSwatRef.current.left = now;
        const angle = Math.atan2(dyLeft, dxLeft);
        const pushX = Math.cos(angle + Math.PI) * 60;
        const pushY = Math.sin(angle + Math.PI) * 40;
        const rot = (angle + Math.PI) * (180 / Math.PI) - 30;

        setSwatState((prev) => ({ ...prev, left: { x: pushX, y: pushY, rot } }));
        setTimeout(() => setSwatState((prev) => ({ ...prev, left: null })), 600);
      }

      if (distRight < SWAT_RADIUS && now - lastSwatRef.current.right > SWAT_COOLDOWN) {
        lastSwatRef.current.right = now;
        const angle = Math.atan2(dyRight, dxRight);
        const pushX = Math.cos(angle + Math.PI) * 60;
        const pushY = Math.sin(angle + Math.PI) * 40;
        const rot = (angle + Math.PI) * (180 / Math.PI) + 30;

        setSwatState((prev) => ({ ...prev, right: { x: pushX, y: pushY, rot } }));
        setTimeout(() => setSwatState((prev) => ({ ...prev, right: null })), 600);
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [isKeyDragging]);

  // Track the cursor so the pupils can follow it.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Compute the pupil offset (in px) for a given eye so the pupil looks toward the cursor.
  const getPupilOffset = (
    eyeRef: React.RefObject<HTMLSpanElement | null>
  ): { x: number; y: number } => {
    if (!mousePos || !eyeRef.current) return { x: 0, y: 0 };

    const eyeRect = eyeRef.current.getBoundingClientRect();
    const eyeCenterX = eyeRect.left + eyeRect.width / 2;
    const eyeCenterY = eyeRect.top + eyeRect.height / 2;

    const deltaX = mousePos.x - eyeCenterX;
    const deltaY = mousePos.y - eyeCenterY;

    // Direction only, capped to the max travel distance of the pupil.
    const maxOffset = 9;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance === 0) return { x: 0, y: 0 };

    return {
      x: (deltaX / distance) * maxOffset,
      y: (deltaY / distance) * maxOffset,
    };
  };

  const leftOffset = getPupilOffset(leftEyeRef);
  const rightOffset = getPupilOffset(rightEyeRef);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 -z-10 flex items-center justify-center"
    >
      <div className="animate-monster-drift motion-reduce:animate-none relative flex items-center justify-center">
        {/* Left Arm & Claw */}
        <div
          ref={leftArmRef}
          className="animate-monster-arm-left motion-reduce:animate-none absolute -left-40 sm:-left-60 md:-left-70 flex items-center opacity-75 dark:opacity-85 pointer-events-none"
          style={
            swatState.left
              ? {
                  animation: "none",
                  transform: `translateX(${swatState.left.x}px) translateY(${swatState.left.y}px) rotate(${swatState.left.rot}deg)`,
                }
              : undefined
          }
        >
          <svg
            className="w-28 h-28 sm:w-36 sm:h-36 text-primary drop-shadow-[0_0_14px_var(--primary)]"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Forearm tapering toward the body murk */}

            {/* Main palm glow / knuckle base */}
            <circle cx="50" cy="50" r="14" fill="currentColor" fillOpacity="0.4" strokeWidth="3" />
            {/* Claws reaching right/inwards */}
            <path d="M 50 36 Q 66 24 82 32" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 52 30 Q 72 16 86 26" strokeWidth="5" strokeLinecap="round" />
            <path d="M 56 24 Q 80 8 90 20" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 62 18 Q 90 4 96 18" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>

        {/* Monster Eyes Container */}
        <div className="relative flex items-center gap-20 sm:gap-28">
          {/* Left Eyebrow */}
          <div className="absolute left-10 top-[-26px] sm:left-14 sm:top-[-32px] h-2 sm:h-2.5 w-20 sm:w-28 bg-primary/70 rounded-full rotate-[8deg]" />

          {/* Left eye */}
          <span
            ref={leftEyeRef}
            className="animate-monster-blink motion-reduce:animate-none relative block h-20 w-32 origin-center rounded-[50%] bg-[radial-gradient(circle_at_50%_50%,var(--primary)_0%,color-mix(in_oklab,var(--primary)_35%,transparent)_38%,transparent_70%)] blur-[1px] opacity-90 dark:opacity-95 sm:h-24 sm:w-40"
            style={{ animationDelay: "-1.2s" }}
          >
            {/* Enhanced pupil with depth */}
            <span
              className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--background)] shadow-[0_0_26px_var(--primary)] sm:h-6 sm:w-6"
              style={{
                transform: `translate(calc(-50% + ${leftOffset.x}px), calc(-50% + ${leftOffset.y}px))`,
                transition: "transform 120ms ease-out",
              }}
            >
              {/* Inner pupil glow */}
              <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25" />
            </span>
          </span>

          {/* Right Eyebrow */}
          <div className="absolute right-10 top-[-26px] sm:right-14 sm:top-[-32px] h-2 sm:h-2.5 w-20 sm:w-28 bg-primary/70 rounded-full -rotate-[8deg]" />

          {/* Right eye */}
          <span
            ref={rightEyeRef}
            className="animate-monster-blink motion-reduce:animate-none relative block h-20 w-32 origin-center rounded-[50%] bg-[radial-gradient(circle_at_50%_50%,var(--primary)_0%,color-mix(in_oklab,var(--primary)_35%,transparent)_38%,transparent_70%)] blur-[1px] opacity-90 dark:opacity-95 sm:h-24 sm:w-40"
            style={{ animationDelay: "-3.6s" }}
          >
            {/* Enhanced pupil with depth */}
            <span
              className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--background)] shadow-[0_0_26px_var(--primary)] sm:h-6 sm:w-6"
              style={{
                transform: `translate(calc(-50% + ${rightOffset.x}px), calc(-50% + ${rightOffset.y}px))`,
                transition: "transform 120ms ease-out",
              }}
            >
              {/* Inner pupil glow */}
              <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25" />
            </span>
          </span>
        </div>


        {/* Right Arm & Claw (mirrored) */}
        <div
          ref={rightArmRef}
          className="animate-monster-arm-right motion-reduce:animate-none absolute -right-40 sm:-right-60 md:-right-70 flex items-center opacity-75 dark:opacity-85 pointer-events-none scale-x-[-1]"
          style={
            swatState.right
              ? {
                  animation: "none",
                  transform: `translateX(${swatState.right.x}px) translateY(${swatState.right.y}px) rotate(${swatState.right.rot}deg) scaleX(-1)`,
                }
              : undefined
          }
        >
          <svg
            className="w-28 h-28 sm:w-36 sm:h-36 text-primary drop-shadow-[0_0_14px_var(--primary)]"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Forearm tapering toward the body murk */}

            {/* Main palm glow / knuckle base */}
            <circle cx="50" cy="50" r="14" fill="currentColor" fillOpacity="0.4" strokeWidth="3" />
            {/* Claws reaching right/inwards */}
            <path d="M 50 36 Q 66 24 82 32" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 52 30 Q 72 16 86 26" strokeWidth="5" strokeLinecap="round" />
            <path d="M 56 24 Q 80 8 90 20" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 62 18 Q 90 4 96 18" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
