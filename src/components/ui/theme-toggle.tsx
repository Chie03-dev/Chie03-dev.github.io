"use client";

import { useHeroLock } from "@/context/hero-lock-context";
import { toggleDarkTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

/**
 * Theme toggle. Flips between the default navy and the pitch-black theme.
 *
 * Locked to the hero's containment: while the portrait is caged the button is
 * disabled and says why, because the dark theme is something the visitor
 * unlocks by breaking the cage rather than a preference they can simply set.
 *
 * Icons are swapped with the `dark:` variant so there is no client state and no
 * hydration mismatch.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { isLocked } = useHeroLock();
  const locked = isLocked;
  const label = locked
    ? "Break the portrait's containment to unlock the dark theme"
    : "Toggle dark theme";

  return (
    <button
      type="button"
      onClick={locked ? undefined : () => toggleDarkTheme()}
      disabled={locked}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background/60 text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        locked
          ? "cursor-not-allowed opacity-50"
          : "hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      {/* Sun: visible in dark mode, click to switch back to the default. */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="hidden h-4 w-4 dark:block"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
      {/* Moon: visible in the default theme, click to unlock the dark theme. */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4 dark:hidden"
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  );
}
