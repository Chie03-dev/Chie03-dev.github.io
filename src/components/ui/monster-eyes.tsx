/**
 * Glooming monster eyes and reaching claws that loom in the murk behind the key. Purely
 * decorative: a Server Component with zero JS.
 * The eyes blink on an uneven cadence and drift slowly side to side.
 * Flanking the eyes are two shadowy arms with sharp glowing claws that creep and reach
 * toward the center.
 * All motion is CSS-driven and respects prefers-reduced-motion.
 */
export function MonsterEyes() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 -z-10 flex items-center justify-center"
    >
      <div className="animate-monster-drift motion-reduce:animate-none relative flex items-center justify-center">
        {/* Left Arm & Claw */}
        <div className="animate-monster-arm-left motion-reduce:animate-none absolute -left-36 sm:-left-56 md:-left-64 flex items-center opacity-75 dark:opacity-85 pointer-events-none">
          <svg
            className="w-24 h-24 sm:w-32 sm:h-32 text-primary drop-shadow-[0_0_12px_var(--primary)]"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Forearm tapering toward the body murk */}
            <path
              d="M-10 65 Q 25 55 52 48"
              strokeWidth="9"
              strokeLinecap="round"
              className="text-foreground/80 dark:text-foreground/60"
            />
            {/* Main palm glow / knuckle base */}
            <circle cx="52" cy="48" r="8" fill="currentColor" fillOpacity="0.4" strokeWidth="3" />
            {/* Claws reaching right/inwards */}
            <path
              d="M 54 42 Q 68 34 82 40"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M 58 48 Q 78 44 94 53"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <path
              d="M 54 54 Q 72 58 86 68"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M 48 56 Q 56 68 66 74"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Monster Eyes Container */}
        <div className="flex items-center gap-16 sm:gap-24">
          {/* Left eye */}
          <span
            className="animate-monster-blink motion-reduce:animate-none relative block h-14 w-24 origin-center rounded-[50%] bg-[radial-gradient(circle_at_50%_50%,var(--primary)_0%,color-mix(in_oklab,var(--primary)_35%,transparent)_38%,transparent_70%)] blur-[1px] opacity-75 dark:opacity-85 sm:h-20 sm:w-32"
            style={{ animationDelay: "-1.2s" }}
          >
            <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--background)] shadow-[0_0_18px_var(--primary)] sm:h-3.5 sm:w-3.5" />
          </span>

          {/* Right eye */}
          <span
            className="animate-monster-blink motion-reduce:animate-none relative block h-14 w-24 origin-center rounded-[50%] bg-[radial-gradient(circle_at_50%_50%,var(--primary)_0%,color-mix(in_oklab,var(--primary)_35%,transparent)_38%,transparent_70%)] blur-[1px] opacity-75 dark:opacity-85 sm:h-20 sm:w-32"
            style={{ animationDelay: "-3.6s" }}
          >
            <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--background)] shadow-[0_0_18px_var(--primary)] sm:h-3.5 sm:w-3.5" />
          </span>
        </div>

        {/* Right Arm & Claw (mirrored) */}
        <div className="animate-monster-arm-right motion-reduce:animate-none absolute -right-36 sm:-right-56 md:-right-64 flex items-center opacity-75 dark:opacity-85 pointer-events-none scale-x-[-1]">
          <svg
            className="w-24 h-24 sm:w-32 sm:h-32 text-primary drop-shadow-[0_0_12px_var(--primary)]"
            viewBox="0 0 100 100"
            fill="none"
            stroke="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Forearm tapering toward the body murk */}
            <path
              d="M-10 65 Q 25 55 52 48"
              strokeWidth="9"
              strokeLinecap="round"
              className="text-foreground/80 dark:text-foreground/60"
            />
            {/* Main palm glow / knuckle base */}
            <circle cx="52" cy="48" r="8" fill="currentColor" fillOpacity="0.4" strokeWidth="3" />
            {/* Claws reaching right/inwards */}
            <path
              d="M 54 42 Q 68 34 82 40"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M 58 48 Q 78 44 94 53"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <path
              d="M 54 54 Q 72 58 86 68"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M 48 56 Q 56 68 66 74"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}