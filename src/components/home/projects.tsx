"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LuChevronLeft, LuChevronRight, LuFolder, LuX } from "react-icons/lu";

import { cn } from "@/lib/utils";
import { portfolioData } from "@/data/portfolio";
import { NotchedProjectCard } from "@/components/ui/notched-project-card";
import { SectionRail } from "@/components/ui/section-rail";

type Project = (typeof portfolioData)["projects"][number];

const BTN =
  "inline-flex items-center justify-center size-9 rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
  const [selected, setSelected] = useState<Project | null>(null);

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

  const closeModal = useCallback(() => setSelected(null), []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal]);

  const scrollByCard = useCallback((dir: number) => {
    const list = listRef.current;
    if (!list) return;
    const card = list.querySelector("li");
    const step = card ? card.clientWidth + 16 : list.clientWidth * 0.8;
    list.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  return (
    <section id="projects">
      <SectionRail rail={false} icon={<LuFolder className="size-4" />}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <h2 className="text-3xl font-bold tracking-tight uppercase">
            RECENT PROJECTS
          </h2>
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
          className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]"
        >
          {projects.map((project) => (
            <li
              key={project.id}
              className="w-[76%] shrink-0 snap-start sm:w-[58%] lg:w-[38%] min-w-0"
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
                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
                  e.preventDefault();
                  setSelected(project);
                }}
              />
            </li>
          ))}
        </ul>

        {selected && (
          <ProjectModal
            project={selected}
            onClose={closeModal}
            year={year}
          />
        )}
      </SectionRail>
    </section>
  );
}

function ProjectModal({
  project,
  onClose,
  year,
}: {
  project: Project;
  onClose: () => void;
  year: (period: string) => string;
}) {
  const { detail } = project;
  const badgeYear = year(project.period);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Case study: ${project.title}`}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-3xl mx-4 md:mx-6 rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/40",
          "transition-all duration-300 ease-out",
          "translate-y-4 opacity-0 sm:translate-y-0 sm:opacity-100",
        )}
      >
        <div className="flex items-center justify-between p-6 border-b border-border/40">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close case study"
            className="rounded-full bg-background p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LuX className="size-5" aria-hidden="true" />
          </button>
          <a
            href={`/projects/${project.slug}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Open full case study →
          </a>
        </div>

        <div className="p-8 md:p-12">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-1/2">
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted relative">
                <img
                  src={project.image}
                  alt={`${project.title} screenshot`}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
                {detail.screenshots.slice(1).map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`${project.title} screenshot ${i + 2}`}
                    className="absolute -bottom-6 -left-6 w-48 h-auto rounded-lg border border-white/20 bg-background shadow-xl"
                    loading="lazy"
                  />
                ))}
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background px-3 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground">
                {badgeYear}
              </span>
            </div>

            <div className="lg:w-1/2 space-y-6">
              <div className="flex flex-wrap gap-2 mb-2">
                {project.technologies.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-border/40 bg-secondary/40 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-secondary-foreground uppercase"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <h3 className="text-3xl font-bold tracking-tight text-foreground">
                {project.title}
              </h3>
              <p className="text-lg leading-relaxed text-muted-foreground">
                {project.description}
              </p>

              <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <span className="w-px h-4 bg-border" />
                  {project.period}
                </span>
              </div>

              {detail.highlights && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  {detail.highlights.metrics.map((m) => (
                    <div
                      key={m.label}
                      className="rounded-lg border border-border/40 bg-secondary/30 p-3"
                    >
                      <div className="text-xl font-bold text-foreground">
                        {m.value}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 pt-2">
                <p className="font-semibold text-foreground uppercase text-xs tracking-wider">
                  The problem
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  {detail.problem}
                </p>

                <p className="font-semibold text-foreground uppercase text-xs tracking-wider">
                  Outcome
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  {detail.outcome}
                </p>
              </div>

              <div className="mt-4 flex gap-3">
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  View on GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
