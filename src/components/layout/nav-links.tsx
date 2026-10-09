"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/types";

interface NavLinksProps {
  items: NavItem[];
}

/**
 * Desktop navigation links with active-section tracking. An IntersectionObserver
 * watches each target section and highlights the link whose section is most
 * visible in the viewport. Isolated as a client leaf so the header shell stays
 * a Server Component.
 */
export function NavLinks({ items }: NavLinksProps) {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.href.replace("/#", "")))
      .filter((element): element is HTMLElement => element !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: [0, 0.25, 0.5, 1] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav
      aria-label="Primary"
      className="hidden items-center gap-1 md:flex"
    >
      {items.map((item) => {
        const id = item.href.replace("/#", "");
        const isActive = id === activeId;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
