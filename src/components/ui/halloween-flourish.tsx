/**
 * Floating Halloween flourishes scattered behind the hero -a carved pumpkin,
 * candy, ghost, witch's wand, and skull. Purely decorative: a Server Component
 * with zero JS. Each glyph is an inline SVG using stroke="currentColor" so it
 * tints with the ambient ember theme and fades to the background. Rendered at
 * low opacity and aria-hidden so they add atmosphere without competing with the
 * content. Hidden on the smallest screens to keep the fold uncluttered.
 *
 * Icons: Tabler Icons (MIT). Verified paths -pumpkin-scary, candy, ghost, wand,
 * skull. There is no Tabler "broom" glyph, so the witch motif uses the wand.
 */
const ICON_PROPS = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function HalloweenFlourish() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden text-primary/25 md:block dark:text-primary/30"
    >
      {/* Carved pumpkin -upper left */}
      <svg {...ICON_PROPS} className="absolute left-[6%] top-[18%] h-16 w-16 lg:h-24 lg:w-24">
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M9 15l1.5 1l1.5 -1l1.5 1l1.5 -1" />
        <path d="M10 11h.01" />
        <path d="M14 11h.01" />
        <path d="M17 6.082c2.609 .588 3.627 4.162 2.723 7.983c-.903 3.82 -2.75 6.44 -5.359 5.853a3.355 3.355 0 0 1 -.774 -.279a3.728 3.728 0 0 1 -1.59 .361c-.556 0 -1.09 -.127 -1.59 -.362a3.296 3.296 0 0 1 -.774 .28c-2.609 .588 -4.456 -2.033 -5.36 -5.853c-.903 -3.82 .115 -7.395 2.724 -7.983c1.085 -.244 1.575 .066 2.585 .787c.716 -.554 1.54 -.869 2.415 -.869c.876 0 1.699 .315 2.415 .87c1.01 -.722 1.5 -1.032 2.585 -.788z" />
        <path d="M12 6c0 -1.226 .693 -2.346 1.789 -2.894l.211 -.106" />
      </svg>

      {/* Candy -right of center, mid height */}
      <svg {...ICON_PROPS} className="absolute right-[12%] top-[42%] h-10 w-10 lg:h-14 lg:w-14">
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M7.05 11.293l4.243 -4.243a2 2 0 0 1 2.828 0l2.829 2.83a2 2 0 0 1 0 2.828l-4.243 4.243a2 2 0 0 1 -2.828 0l-2.829 -2.831a2 2 0 0 1 0 -2.828z" />
        <path d="M16.243 9.172l3.086 -.772a1.5 1.5 0 0 0 .697 -2.516l-2.216 -2.217a1.5 1.5 0 0 0 -2.44 .47l-1.248 2.913" />
        <path d="M9.172 16.243l-.772 3.086a1.5 1.5 0 0 1 -2.516 .697l-2.217 -2.216a1.5 1.5 0 0 1 .47 -2.44l2.913 -1.248" />
      </svg>

      {/* Ghost -lower left */}
      <svg {...ICON_PROPS} className="absolute bottom-[16%] left-[16%] h-12 w-12 lg:h-16 lg:w-16">
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M5 11a7 7 0 0 1 14 0v7a1.78 1.78 0 0 1 -3.1 1.4a1.65 1.65 0 0 0 -2.6 0a1.65 1.65 0 0 1 -2.6 0a1.65 1.65 0 0 0 -2.6 0a1.78 1.78 0 0 1 -3.1 -1.4v-7" />
        <path d="M10 10l.01 0" />
        <path d="M14 10l.01 0" />
        <path d="M10 14a3.5 3.5 0 0 0 4 0" />
      </svg>

      {/* Witch's wand -right side, lower */}
      <svg {...ICON_PROPS} className="absolute bottom-[24%] right-[8%] h-12 w-12 lg:h-16 lg:w-16">
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M6 21l15 -15l-3 -3l-15 15l3 3" />
        <path d="M15 6l3 3" />
        <path d="M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" />
        <path d="M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" />
      </svg>

      {/* Skull -top right, half-faded into the fold */}
      <svg {...ICON_PROPS} className="absolute right-[22%] top-[8%] h-10 w-10 opacity-60 lg:h-14 lg:w-14">
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M12 4c4.418 0 8 3.358 8 7.5c0 1.901 -.755 3.637 -2 4.96l0 2.54a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-2.54c-1.245 -1.322 -2 -3.058 -2 -4.96c0 -4.142 3.582 -7.5 8 -7.5z" />
        <path d="M10 17v3" />
        <path d="M14 17v3" />
        <path d="M9 11m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
        <path d="M15 11m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      </svg>
    </div>
  );
}
