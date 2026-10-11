"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  /** Extra classes for the wrapper (e.g. layout, height). */
  className?: string;
  /** Stagger delay in milliseconds before the reveal transition starts. */
  delay?: number;
}

/**
 * Scroll-reveal wrapper. Fades and lifts its children into place the first time
 * they scroll into view, then unobserves so it costs nothing afterwards. Uses a
 * native IntersectionObserver (no library). Under reduced motion the content is
 * shown immediately with no transition, so nothing is ever hidden from users who
 * opt out of animation.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion (or no IO support): show content immediately.
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      el.dataset.revealed = "true";
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.dataset.revealed = "true";
            observer.unobserve(el);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-revealed="false"
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn("reveal", className)}
    >
      {children}
    </div>
  );
}
