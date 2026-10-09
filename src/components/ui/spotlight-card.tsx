"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Lightweight wrapper that tracks the pointer position and exposes it as the
 * --mouse-x and --mouse-y CSS variables, which drive the .spotlight-glow border
 * gradient. The glow layer is masked to a thin border ring and revealed on
 * hover, so no layout shifts and the card interior is untouched.
 */
export function SpotlightCard({ children, className }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    element.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      className={cn("group relative h-full [&>*]:h-full", className)}
    >
      {children}
      <div
        aria-hidden="true"
        className="spotlight-glow pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
    </div>
  );
}
