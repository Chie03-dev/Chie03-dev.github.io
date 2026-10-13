import Link from "next/link";

import { CommandTrigger } from "@/components/layout/command-trigger";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLinks } from "@/components/layout/nav-links";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { site } from "@/lib/site";
import type { NavItem } from "@/types";

const NAV_ITEMS: NavItem[] = [
  { label: "About", href: "/#about" },
  { label: "Projects", href: "/#projects" },
  { label: "Skills", href: "/#skills" },
  { label: "Contact", href: "/#contact" },
];

// Initials derived from the configured name (first letter of the first two
// words), falling back to a single letter.
const INITIALS = site.name
  .split(" ")
  .map((part) => part[0])
  .filter(Boolean)
  .slice(0, 2)
  .join("");

/**
 * Floating pill navigation. A Server Component that renders the centered,
 * glassmorphic island; all interactivity (active-section tracking, command
 * palette trigger, mobile menu) lives in client leaf components.
 */
export function Navbar() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <header className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-background/80 px-3 py-2 shadow-lg shadow-black/5 backdrop-blur-md sm:gap-2 sm:px-4">
        {/* Brand + availability dot */}
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold uppercase text-primary-foreground">
            {INITIALS}
          </span>
          <span className="hidden text-sm font-semibold tracking-tight lg:inline">
            {site.githubUsername}
          </span>
          <span className="relative flex h-2 w-2" aria-label="Available">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
        </Link>

        {/* Desktop navigation with active-section tracking */}
        <NavLinks items={NAV_ITEMS} />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <CommandTrigger />
          <Link
            href={site.resumeUrl}
            className="hidden items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
          >
            Resume
          </Link>
          <MobileNav items={NAV_ITEMS} />
        </div>
      </header>
    </div>
  );
}

