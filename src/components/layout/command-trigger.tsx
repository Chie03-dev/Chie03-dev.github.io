"use client";

import { useEffect, useState } from "react";

/**
 * Command palette trigger. Clicking it dispatches the same Cmd/Ctrl+K keydown
 * event the CommandPalette already listens for, so the palette opens without
 * duplicating any open/close logic. The modifier label is resolved after mount
 * to avoid a hydration mismatch.
 */
export function CommandTrigger() {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent));
  }, []);

  function openPalette() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  }

  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label="Open command palette"
      className="hidden items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
    >
      <span aria-hidden="true">{isMac ? "\u2318" : "Ctrl"}</span>
      <span aria-hidden="true">K</span>
    </button>
  );
}
