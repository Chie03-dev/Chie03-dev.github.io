"use client";

import { useEffect, useState } from "react";

const GLYPHS = "!@#$%^&*()_+-=[]{}|;:,.<>?";
const DURATION = 1200;

interface TextScrambleProps {
  text: string;
  className?: string;
}

/**
 * Scrambles each character through random ASCII glyphs, then resolves left to
 * right into the target string over 1.2s. The real text is rendered during SSR
 * and when the user prefers reduced motion, so the copy stays readable and
 * crawlable either way.
 */
export function TextScramble({ text, className }: TextScrambleProps) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const start = performance.now();

    function frame(now: number) {
      const progress = Math.min((now - start) / DURATION, 1);
      const revealed = Math.floor(progress * text.length);
      let output = "";
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === " " || i < revealed) output += char;
        else output += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setDisplay(output);
      if (progress < 1) raf = requestAnimationFrame(frame);
      else setDisplay(text);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [text]);

  return (
    <span className={className}>
      <span aria-hidden="true">{display}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
