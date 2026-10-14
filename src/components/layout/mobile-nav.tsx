"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/types";

interface MobileNavProps {
  items: NavItem[];
}

/**
 * Client leaf for the mobile navigation. Owns only the open/close state so the
 * rest of the header can stay a Server Component. Closes on link click and on
 * the Escape key for accessibility.
 *
 * The trigger is text rather than an icon: the nav is text-only by design, and
 * a word button keeps the tap target readable at small sizes.
 */
export function MobileNav({ items }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Toggle navigation menu"
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="inline-flex h-9 items-center justify-center rounded-full border border-border/60 bg-background/60 px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? "Close" : "Menu"}
      </button>

      {open ? (
        <div
          id="mobile-menu"
          className="fixed inset-x-4 top-20 z-50 rounded-2xl border border-border/60 bg-background/95 p-2 shadow-lg shadow-black/5 backdrop-blur-md md:hidden"
        >
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/#contact"
              onClick={() => setOpen(false)}
              className={cn(
                "mt-1 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90",
              )}
            >
              Get in Touch
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
