"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LuChevronLeft, LuChevronRight, LuFolder, LuLink } from "react-icons/lu";

import { portfolioData } from "@/data/portfolio";
import { NotchedProjectCard } from "@/components/ui/notched-project-card";
import { SectionRail } from "@/components/ui/section-rail";

const BTN =
  "inline-flex items-center justify-center size-10 rounded-xl border border-border bg-background text-muted-foreground transition-all hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-sm hover:shadow-md";

const CARD_W = "w-[74%] shrink-0 snap-start sm:w-[56%] lg:w-[34%] min-w-0";

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
 * arrow-scrollable for the keyboard. Prev/Next buttons give pointer users the
 * same slide behaviour, and the row stays focusable so keyboard visitors can
 * pan it without a pointer.
 */
export default function Projects() {
  const { projects } = portfolioData;
  const year = (period: string) => period.match(/\d{4}/)?.[0] ?? period;
  const listRef = useRef<HTMLUListElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const updateScrollState = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    setCanScrollPrev(list.scrollLeft > 8);
    setCanScrollNext(list.scrollLeft < list.scrollWidth - list.clientWidth - 8);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.addEventListener("scroll", updateScrollState, { passive: true });
    updateScrollState();
    return () => list.removeEventListener("scroll", updateScrollState);
  }, [updateScrollState]);

  const scrollByCard = useCallback((dir: number) => {
    const list = listRef.current;
    if (!list) return;
    const card = list.querySelector("li");
    const step = card ? card.clientWidth + 16 : list.clientWidth * 0.8;
    list.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  return (
    <section id="projects" className="relative">
      <SectionRail rail={false} icon={<LuFolder className="size-4" />}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight uppercase text-foreground">
              Recent Projects
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A selection of work across Android, web, desktop, and systems.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              disabled={!canScrollPrev}
              aria-label="Scroll projects left"
              className={BTN}
            >
              <LuChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              disabled={!canScrollNext}
              aria-label="Scroll projects right"
              className={BTN}
            >
              <LuChevronRight className="size-4" aria-hidden="true" />
            </button>
            <a
              href="/projects"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View all <LuLink className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <ul
          ref={listRef}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label="Recent projects, scrollable sideways"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              scrollByCard(1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              scrollByCard(-1);
            }
          }}
          className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-4 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]"
        >
          {projects.map((project) => (
            <li
              key={project.id}
              className={CARD_W}
            >
              <NotchedProjectCard
                href={`/projects/${project.slug}`}
                title={project.title}
                description={project.description}
                image={project.image}
                imageAlt={`${project.title} screenshot`}
                badge={year(project.period)}
                tags={project.technologies}
                monochrome
                ariaLabel={`Read ${project.title} case study`}
              />
            </li>
          ))}
        </ul>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 h-[2px] w-[10%] bg-gradient-to-r from-transparent via-primary/50 to-transparent pointer-events-none" aria-hidden="true" />
      </SectionRail>
    </section>
  );
}
