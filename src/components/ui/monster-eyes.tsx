"use client";

import { useEffect, useRef, useState } from "react";
import { useHeroLock } from "@/context/hero-lock-context";

/**
 * Interactive monster eyes with reaching claws that react to the key.
 * Tracks pointer proximity and triggers a "swat" animation when the key gets too close.
 * All ambient motion is CSS-driven; swat is triggered via inline style.
 */
export function MonsterEyes() {
  const { isKeyDragging } = useHeroLock();
  const containerRef = useRef<HTMLDivElement>(null);
  const leftArmRef = useRef<HTMLDivElement>(null);
  const rightArmRef = useRef<HTMLDivElement>(null);
  const [swatState, setSwatState] = useState<{
    left: { x: number; y: number; rot: number } | null;
    right: { x: number; y: number; rot: number } | null;
  }>({ left: null, right: null });

  const lastSwatRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const SWAT_COOLDOWN = 1500;

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
          className="animate-monster-arm-left motion-reduce:animate-none absolute -left-36 sm:-left-56 md:-left-64 flex items-center opacity-75 dark:opacity-85 pointer-events-none"
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
            className="w-24 h-24 sm:w-32 sm:h-32 text-primary drop-shadow-[0_0_12px_var(--primary)]"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Forearm tapering toward the body murk */}
            <path
              d="M-10 65 Q 25 55 52 48"
              strokeWidth="9"
              strokeLinecap="round"
              className="text-foreground/80 dark:text-foreground/60"
            />
            {/* Main palm glow / knuckle base */}
            <circle cx="52" cy="48" r="8" fill="currentColor" fillOpacity="0.4" strokeWidth="3" />
            {/* Claws reaching right/inwards */}
            <path d="M 54 42 Q 68 34 82 40" strokeWidth="4" strokeLinecap="round" />
            <path d="M 58 48 Q 78 44 94 53" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 54 54 Q 72 58 86 68" strokeWidth="4" strokeLinecap="round" />
            <path d="M 48 56 Q 56 68 66 74" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Monster Eyes Container */}
        <div className="flex items-center gap-16 sm:gap-24">
          {/* Left eye */}
          <span
            className="animate-monster-blink motion-reduce:animate-none relative block h-14 w-24 origin-center rounded-[50%] bg-[radial-gradient(circle_at_50%_50%,var(--primary)_0%,color-mix(in_oklab,var(--primary)_35%,transparent)_38%,transparent_70%)] blur-[1px] opacity-75 dark:opacity-85 sm:h-20 sm:w-32"
            style={{ animationDelay: "-1.2s" }}
          >
            <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--background)] shadow-[0_0_18px_var(--primary)] sm:h-3.5 sm:w-3.5" />
          </span>

          {/* Right eye */}
          <span
            className="animate-monster-blink motion-reduce:animate-none relative block h-14 w-24 origin-center rounded-[50%] bg-[radial-gradient(circle_at_50%_50%,var(--primary)_0%,color-mix(in_oklab,var(--primary)_35%,transparent)_38%,transparent_70%)] blur-[1px] opacity-75 dark:opacity-85 sm:h-20 sm:w-32"
            style={{ animationDelay: "-3.6s" }}
          >
            <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--background)] shadow-[0_0_18px_var(--primary)] sm:h-3.5 sm:w-3.5" />
          </span>
        </div>

        {/* Right Arm & Claw (mirrored) */}
        <div
          ref={rightArmRef}
          className="animate-monster-arm-right motion-reduce:animate-none absolute -right-36 sm:-right-56 md:-right-64 flex items-center opacity-75 dark:opacity-85 pointer-events-none scale-x-[-1]"
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
            className="w-24 h-24 sm:w-32 sm:h-32 text-primary drop-shadow-[0_0_12px_var(--primary)]"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Forearm tapering toward the body murk */}
            <path
              d="M-10 65 Q 25 55 52 48"
              strokeWidth="9"
              strokeLinecap="round"
              className="text-foreground/80 dark:text-foreground/60"
            />
            {/* Main palm glow / knuckle base */}
            <circle cx="52" cy="48" r="8" fill="currentColor" fillOpacity="0.4" strokeWidth="3" />
            {/* Claws reaching right/inwards */}
            <path d="M 54 42 Q 68 34 82 40" strokeWidth="4" strokeLinecap="round" />
            <path d="M 58 48 Q 78 44 94 53" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 54 54 Q 72 58 86 68" strokeWidth="4" strokeLinecap="round" />
            <path d="M 48 56 Q 56 68 66 74" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}