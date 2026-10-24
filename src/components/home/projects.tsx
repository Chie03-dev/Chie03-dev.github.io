"use client";

import type React from "react";

import { portfolioData } from "@/data/portfolio";
import { NotchedProjectCard } from "@/components/ui/notched-project-card";
import { SectionRail } from "@/components/ui/section-rail";

/**
 * Recent work, as notched project cards: the cover's bottom-right corner is cut
 * away with the "open" arrow nested in it.
 *
 * The notch is a mask rather than a painted patch, so whatever sits behind the
 * card shows through it - which matters here because the site layers a dusk
 * tint behind the content that deepens as the page scrolls.
 *
 * The cards run as a horizontal rail rather than a grid: a fourth card in a
 * three-column grid wraps to a second row on its own, which reads as a layout
 * mistake. One scrollable row keeps them together, swipeable on touch and
 * arrow-scrollable for the keyboard. The row is focusable so a keyboard visitor
 * can pan it without a pointer.
 */
export default function Projects() {
  const { projects } = portfolioData;
  const year = (period: string) => period.match(/\d{4}/)?.[0] ?? period;

  function scrollByCard(e: React.KeyboardEvent<HTMLUListElement>, dir: number) {
    const ul = e.currentTarget;
    const card = ul.querySelector("li");
    const step = card ? card.clientWidth + 16 : ul.clientWidth * 0.8;
    ul.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  return (
    <section id="projects">
      <SectionRail rail={false}>
        <h2 className="mb-6 text-3xl font-bold tracking-tight uppercase">
          RECENT PROJECTS
        </h2>

        <ul
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label="Recent projects, scrollable sideways"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              scrollByCard(e, 1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              scrollByCard(e, -1);
            }
          }}
          className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]"
        >
          {projects.map((project) => (
            <li
              key={project.id}
              className="w-[76%] shrink-0 snap-start sm:w-[58%] lg:w-[38%] min-w-0"
            >
              <NotchedProjectCard
                href={project.link}
                title={project.title}
                description={project.description}
                image={project.image}
                imageAlt={`${project.title} screenshot`}
                badge={year(project.period)}
                tags={project.technologies}
                monochrome
                ariaLabel={`Open ${project.title}`}
              />
            </li>
          ))}
        </ul>
      </SectionRail>
    </section>
  );
}
