import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * NotchedProjectCard
 *
 * A project cover card with a rounded notch bitten out of its bottom-right
 * corner and an "open case study" button nested inside it. The cut is
 * concentric with the button disc and filleted where it meets the cover's
 * edges, so the cover curves into it instead of ending on a point.
 *
 * The notch is painted in the colour of the surface BEHIND the card
 * (`surface`, the section background by default). Put the card on a different
 * background and pass that colour, or the notch shows a seam.
 *
 * Pure CSS hover (group-hover) so this stays a Server Component; the parent
 * section owns the drawer open state and passes `onOpen`.
 */

export interface NotchedProjectCardProps {
  title: string;
  description: string;
  /** cover photograph in public/ */
  image: string;
  imageAlt?: string;
  /** a pill at the top of the cover, e.g. the year */
  badge?: string;
  tags?: string[];
  monochrome?: boolean;
  /** the colour behind the card; the notch is painted in it */
  surface?: string;
  onOpen: () => void;
  className?: string;
}

const DISC = 64; // the arrow button, px
const BLOCK = 80; // the notch block, px (radius = BLOCK - DISC / 2)
const FILLET = 28; // the curve where the cut meets the cover's edges, px
const MAX_TAGS = 4;

function ArrowUpRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
    >
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

export function NotchedProjectCard({
  title,
  description,
  image,
  imageAlt = "",
  badge,
  tags = [],
  monochrome = true,
  surface = "var(--color-background)",
  onOpen,
  className,
}: NotchedProjectCardProps) {
  const tone = monochrome
    ? "grayscale transition-[filter,scale] duration-500 group-hover:grayscale-0 group-focus-visible:grayscale-0"
    : "transition-[scale] duration-500";

  return (
    <article className={cn("group flex flex-col outline-none", className)}>
      <div className="relative">
        {/* the cover */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-muted">
          <Image
            src={image}
            alt={imageAlt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className={cn(
              "object-cover group-hover:scale-[1.04]",
              tone,
            )}
          />
          {badge && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-4">
              <span className="rounded-full border border-white/40 bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                {badge}
              </span>
            </div>
          )}
        </div>

        {/* the notch: a block with a concave corner, and a fillet at each
            end where the cut meets the cover's right and bottom edges */}
        <div
          aria-hidden
          className="absolute bottom-0 right-0"
          style={{ width: BLOCK, height: BLOCK, borderTopLeftRadius: BLOCK - DISC / 2, background: surface }}
        />
        {[
          { bottom: BLOCK, right: 0 },
          { bottom: 0, right: BLOCK },
        ].map((pos, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute"
            style={{
              ...pos,
              width: FILLET,
              height: FILLET,
              background: `radial-gradient(circle at top left, transparent ${FILLET - 0.5}px, ${surface} ${FILLET}px)`,
            }}
          />
        ))}

        {/* the open button, nested in the notch */}
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${title} case study`}
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-[background-color,color,scale] duration-300 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ width: DISC, height: DISC }}
        >
          <ArrowUpRightIcon />
        </button>
      </div>

      <h3 className="mt-5 text-2xl font-medium tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {tags.slice(0, MAX_TAGS).map((t, i) => (
            <li
              key={`${t}-${i}`}
              className="rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground"
            >
              {t}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
