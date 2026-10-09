"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
}

const PULL = 0.35;

/**
 * Wraps a control and nudges it toward the cursor on pointer move for a subtle
 * magnetic feel. The offset is written straight to the DOM (no re-renders) and
 * eases back to zero on leave. Skipped entirely when the user prefers reduced
 * motion.
 */
export function MagneticButton({ children, className }: MagneticButtonProps) {
  const ref = useRef<HTMLSpanElement>(null);

  function handlePointerMove(event: PointerEvent<HTMLSpanElement>) {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - (rect.left + rect.width / 2)) * PULL;
    const y = (event.clientY - (rect.top + rect.height / 2)) * PULL;
    element.style.transform = `translate(${x}px, ${y}px)`;
  }

  function handlePointerLeave() {
    const element = ref.current;
    if (element) element.style.transform = "translate(0px, 0px)";
  }

  return (
    <span
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn(
        "inline-flex transition-transform duration-200 ease-out will-change-transform",
        className,
      )}
    >
      {children}
    </span>
  );
}
