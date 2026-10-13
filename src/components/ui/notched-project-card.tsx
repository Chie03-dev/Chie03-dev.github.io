"use client";

import * as React from "react";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * NotchedProjectCard
 *
 * A project card whose cover has a rounded notch bitten out of its
 * bottom-right corner, with the "open" arrow nested inside it. The cut is
 * concentric with the arrow disc, and filleted where it meets the cover's
 * edges, so the cover curves into it instead of ending on a point.
 *
 * The notch is drawn by three layers painted in the colour of the surface
 * BEHIND the card (`surface`, the page background by default). Put the card
 * on a different background and pass that colour, or the notch shows.
 *
 * Optional extras:
 * - `screen`: a product screen layered over the cover photo. The photo holds
 *   still and the screen grows on hover, so the card gains depth instead of
 *   just zooming.
 * - `monochrome`: the cover sits in black and white and takes its colours
 *   back on hover or keyboard focus.
 */

export interface NotchedProjectCardProps {
  href: string;
  title: string;
  description?: string;
  /** cover photograph */
  image: string;
  imageAlt?: string;
  /** a pill at the top of the cover, e.g. the year */
  badge?: string;
  tags?: string[];
  /** a product screen over the photo (transparent PNG/WebP works best) */
  screen?: { src: string; alt: string; className?: string };
  /** a dark wash between the photo and the screen, 0 to 1 */
  dim?: number;
  monochrome?: boolean;
  /** the arrow disc's fill on hover (any CSS colour); defaults to the theme's primary */
  accent?: string;
  /** the arrow's colour on that fill; pick one that contrasts with `accent` */
  accentForeground?: string;
  className?: string;
}

const DISC = 64; // the arrow disc, px

export function NotchedProjectCard({
  href,
  title,
  description,
  image,
  imageAlt = "",
  badge,
  tags = [],
  screen,
  dim = screen ? 0.45 : 0,
  monochrome = false,
  accent,
  accentForeground = "#0a0a0a",
  className,
}: NotchedProjectCardProps) {
  // The covers are plain <img> on purpose. The site is a static export
  // (output: "export") with images.unoptimised, which is exactly the case where
  // next/image has nothing left to optimise and only adds a client runtime.
  /* eslint-disable @next/next/no-img-element */
  const tone = monochrome
    ? "grayscale transition-[filter,scale] duration-500 group-hover:grayscale-0 group-focus-visible:grayscale-0"
    : "transition-[scale] duration-500";

  return (
    <a
      href={href}
      className={cn(
        "group flex flex-col rounded-[28px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background",
        className,
      )}
    >
      <div className="relative">
        {/* the cover */}
        <div
          className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-muted"
          style={{
            // The notch is CUT OUT with a mask, not painted over with the
            // background colour: this site layers a fixed dusk tint behind the
            // content that darkens as the page scrolls, so a painted patch
            // would read as a lighter square. A mask lets whatever is behind
            // the card show through the notch, dusk and all.
            //
            // The hole is centred on the disc and slightly larger than it, so
            // a ring of background is visible around the arrow. Centring it on
            // the corner instead would leave the disc sitting half on the
            // photo.
            maskImage:
              "radial-gradient(circle 44px at calc(100% - 32px) calc(100% - 32px), transparent 43.5px, #000 44.5px)",
            WebkitMaskImage:
              "radial-gradient(circle 44px at calc(100% - 32px) calc(100% - 32px), transparent 43.5px, #000 44.5px)",
          }}
        >
          <img
            src={image}
            alt={screen ? "" : imageAlt}
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              tone,
              !screen && "group-hover:scale-[1.04]",
            )}
          />
          {dim > 0 && (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ backgroundColor: `rgb(0 0 0 / ${dim})` }}
            />
          )}
          {screen && (
            <img
              src={screen.src}
              alt={screen.alt}
              className={cn(
                "absolute bottom-0 right-0 w-[82%] origin-bottom-right drop-shadow-[0_18px_40px_rgba(0,0,0,0.5)] group-hover:scale-[1.07]",
                tone,
                screen.className,
              )}
            />
          )}
          {badge && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-4">
              <span className="rounded-full border border-white/40 bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                {badge}
              </span>
            </div>
          )}
        </div>

        {/* the notch, cut out of the cover by the mask above; the arrow is
            nested inside the hole. The mask keeps whatever is behind the card
            showing through, so no colour has to be guessed here. */}

        {/* the arrow, nested in the notch */}
        <span
          aria-hidden
          className={cn(
            "absolute right-0 bottom-0 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-[background-color,color,scale] duration-300 group-hover:scale-105",
            accent
              ? "group-hover:bg-[var(--card-accent)] group-hover:text-[var(--card-accent-fg)]"
              : "group-hover:bg-primary group-hover:text-primary-foreground",
          )}
          style={
            {
              width: DISC,
              height: DISC,
              "--card-accent": accent,
              "--card-accent-fg": accentForeground,
            } as React.CSSProperties
          }
        >
          <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>

      <h3 className="mt-5 text-2xl font-medium tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {tags.map((t, i) => (
            <li
              key={`${t}-${i}`}
              className="rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold tracking-wider text-secondary-foreground uppercase"
            >
              {t}
            </li>
          ))}
        </ul>
      )}
    </a>
  );
}

export default NotchedProjectCard;
