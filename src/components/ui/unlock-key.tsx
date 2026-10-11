"use client";

import { useRef } from "react";

import { useHeroLock } from "@/context/hero-lock-context";
import { cn } from "@/lib/utils";

const DRAG_THRESHOLD = 6;
const PORTRAIT_ID = "hero-portrait";

/**
 * Master Key trigger widget. Works two ways: click (or Enter) to unlock
 * directly, or drag the key onto the hero portrait - a floating ghost follows
 * the pointer and the cage glows while the key hovers it. Pointer Events cover
 * mouse, pen, and touch; `touch-none` stops the page scrolling mid-drag. Once
 * unbound it becomes a static status indicator. `aria-live` announces changes.
 */
export function UnlockKey() {
  const { isLocked, isKeyDragging, unlockHero, setKeyDragging, setDropHot } =
    useHeroLock();
  const ghostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0 });

  // Once unbound, nothing remains where the key sat — the containment is gone,
  // so render nothing instead of a status pill.
  if (!isLocked) {
    return null;
  }

  function moveGhost(clientX: number, clientY: number) {
    const ghost = ghostRef.current;
    if (ghost) {
      ghost.style.transform = `translate(${clientX - 20}px, ${clientY - 20}px)`;
      ghost.style.opacity = "1";
    }
  }

  function hideGhost() {
    const ghost = ghostRef.current;
    if (ghost) {
      ghost.style.opacity = "0";
    }
  }

  // Hit-test against the hero portrait box for hover glow and drop unlock.
  function overPortrait(clientX: number, clientY: number): boolean {
    const target = document.getElementById(PORTRAIT_ID);
    if (!target) return false;
    const box = target.getBoundingClientRect();
    return (
      clientX >= box.left &&
      clientX <= box.right &&
      clientY >= box.top &&
      clientY <= box.bottom
    );
  }

  // Begin tracking a potential drag. The ghost stays hidden until the pointer
  // moves past the click threshold, so plain clicks never flash a ghost.
  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  // Past the threshold this is a drag: show the ghost and flag the drag state
  // so the cage can react. setDropHot fires only over the portrait box so the
  // glow flares on a true hover, not on any drag anywhere on the page.
  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag.active) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      setKeyDragging(true);
    }
    moveGhost(event.clientX, event.clientY);
    setDropHot(overPortrait(event.clientX, event.clientY));
  }

  // Release: unlock only if the pointer is over the portrait drop zone.
  // Whether or not the drop lands, reset the cage glow and drag state.
  function endDrag(clientX: number, clientY: number) {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;
    hideGhost();
    setKeyDragging(false);
    setDropHot(false);
    if (drag.moved && overPortrait(clientX, clientY)) {
      unlockHero();
    }
  }

  function handlePointerCancel() {
    dragRef.current.active = false;
    hideGhost();
    setKeyDragging(false);
    setDropHot(false);
  }

  // A real drag ends with a click event too; swallow it so the button does not
  // fire unlock twice (or unlock after a missed drop).
  function handleClick() {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    unlockHero();
  }

  return (
    <div className="mx-auto mt-16 flex w-fit flex-col items-center gap-3">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => endDrag(event.clientX, event.clientY)}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
        aria-label="Break containment and unlock the hero. Drag onto the portrait or activate to unlock."
        title="Master Key — drag onto the portrait to break containment"
        className={cn(
          "group inline-flex touch-none items-center justify-center rounded-full border border-primary/40 bg-primary/10 p-3",
          "cursor-grab text-foreground",
          "transition-all duration-200 ease-out hover:border-primary/70 hover:bg-primary/20",
          "hover:shadow-lg hover:shadow-primary/20 active:cursor-grabbing",
          isKeyDragging && "scale-95 border-primary/70 shadow-lg shadow-primary/20",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-7 w-7 text-primary transition-transform duration-200 group-hover:-rotate-12"
        >
          <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      </button>

      {/* Floating drag ghost that follows the pointer while dragging. Fixed
          positioning with a full-viewport inset so translate() maps directly to
          client coordinates. */}
      <div
        ref={ghostRef}
        aria-hidden="true"
        data-ghost="key"
        className="pointer-events-none fixed inset-0 left-0 top-0 z-[100] h-10 w-10 opacity-0"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-10 w-10 text-primary drop-shadow-[0_0_8px_var(--primary)]"
        >
          <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      </div>
    </div>
  );
}
