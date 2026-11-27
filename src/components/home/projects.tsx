"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LuArrowUpRight,
  LuChevronLeft,
  LuChevronRight,
  LuFolder,
  LuGlobe,
  LuLayers,
  LuShieldAlert,
  LuTarget,
  LuX,
} from "react-icons/lu";

import { cn } from "@/lib/utils";
import { portfolioData } from "@/data/portfolio";
import { NotchedProjectCard } from "@/components/ui/notched-project-card";
import { SectionRail } from "@/components/ui/section-rail";
import { Reveal } from "@/components/ui/reveal";

type Project = (typeof portfolioData)["projects"][number];

const BTN =
  "inline-flex items-center justify-center size-9 rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background";

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
 *
 * Clicking a card opens the project case study in a modal instead of a
 * separate page, so the full story - problem, constraints, decisions,
 * trade-offs, metrics and outcome - stays in one place.
 */
export default function Projects() {
  const { projects } = portfolioData;
  const year = (period: string) => period.match(/\d{4}/)?.[0] ?? period;
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);

  // Lock page scroll when modal is open: pin body at current scroll position
  // so Lenis/smooth-scroll and any wheel events cannot move the page behind.
  useEffect(() => {
    if (!selected) return;

    const scrollY = window.scrollY;
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.width = "100%";

    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [selected]);

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

  const closeModal = useCallback(() => {
    const trigger = triggerRef.current;
    setSelected(null);
    trigger?.focus({ preventScroll: true });
  }, []);

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
          <div className="flex items-end gap-2">
            <h2 className="text-3xl font-bold tracking-tight uppercase mb-0">
              RECENT PROJECTS
            </h2>
            <span className="h-1 w-[40px] rounded-full bg-accent" />
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
          </div>
        </div>

        <Reveal className="mb-6">
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
                className="w-[76%] shrink-0 snap-start sm:w-[58%] lg:w-[38%] min-w-0 group relative"
              >
                <NotchedProjectCard
                  as="button"
                  title={project.title}
                  description={project.description}
                  image={project.image}
                  imageAlt={`${project.title} screenshot`}
                  badge={year(project.period)}
                  status={project.status}
                  tags={project.technologies}
                  monochrome
                  ariaLabel={`View ${project.title} case study`}
                  onClick={(e: React.MouseEvent) => {
                    if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
                    e.preventDefault();
                    triggerRef.current = e.currentTarget as HTMLElement;
                    setSelected(project);
                  }}
                />
                <span
                  className="absolute bottom-2 right-2 bg-black/50 px-2 py-0.5 rounded text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  Open case study
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        {selected && (
          <ProjectModal
            project={selected}
            projects={projects}
            onClose={closeModal}
            onNavigate={(dir) => {
              const i = projects.findIndex((p) => p.id === selected.id);
              const next = Math.max(0, Math.min(projects.length - 1, i + dir));
              if (next === i) return;
              setSelected(projects[next]);
            }}
          />
        )}
      </SectionRail>
    </section>
  );
}

function ProjectModal({
  project,
  projects,
  onClose,
  onNavigate,
}: {
  project: Project;
  projects: Project[];
  onClose: () => void;
  onNavigate: (dir: -1 | 1) => void;
}) {
  const { detail } = project;
  const screenshots = detail.screenshots;
  const modalRef = useRef<HTMLDivElement>(null);
  const badgeYear = project.period.match(/\d{4}/)?.[0] ?? project.period;
  const index = projects.findIndex((p) => p.id === project.id);
  const hasPrev = index > 0;
  const hasNext = index < projects.length - 1;
  const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(
    wordCount(detail.role) +
    wordCount(detail.problem) +
    detail.constraints.reduce((sum, c) => sum + wordCount(c), 0) +
    detail.decisions.reduce((sum, d) => sum + wordCount(d), 0) +
    detail.tradeoffs.reduce((sum, t) => sum + wordCount(t), 0) +
    wordCount(detail.outcome) +
    detail.whatIdoDifferently.reduce((sum, w) => sum + wordCount(w), 0)
  ) / 200);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    const firstFocusable = modalRef.current?.querySelector('a[href], button');
    if (firstFocusable) (firstFocusable as HTMLElement).focus();
  }, [project]);

  // Trap focus inside the modal while open
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    const onKey = (e: KeyboardEvent) => {
      if (galleryOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setGalleryOpen(false);
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setGalleryIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setGalleryIndex((i) => Math.min(screenshots.length - 1, i + 1));
          return;
        }
        return;
      }
      if (e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        onNavigate(-1);
      } else if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        onNavigate(1);
      } else if (e.key !== "Tab") {
        return;
      }
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    modal.addEventListener("keydown", onKey);
    return () => modal.removeEventListener("keydown", onKey);
  }, [
    project,
    hasPrev,
    hasNext,
    onNavigate,
    galleryOpen,
    galleryIndex,
    detail.screenshots,
    screenshots.length,
  ]);

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label={project.title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
        onWheel={(e) => e.preventDefault()}
        onTouchMove={(e) => e.preventDefault()}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-[960px] max-h-[92vh] flex flex-col rounded-3xl border border-border/70 bg-card shadow-2xl shadow-black/40 overflow-hidden",
          "transition-all duration-400 ease-out",
          "translate-y-4 opacity-0 sm:translate-y-0 sm:opacity-100",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close case study"
          className="absolute top-4 right-4 z-30 rounded-full bg-black/30 p-2 text-white hover:bg-black/50 backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <LuX className="size-5" aria-hidden="true" />
        </button>

        {/* Hero cover with faded detail screenshots behind it */}
        <div className="group relative h-64 lg:h-80 w-full overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.image}
            alt={`${project.title} screenshot`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
          {detail.screenshots.slice(1).map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setGalleryIndex(i + 1);
                setGalleryOpen(true);
              }}
              aria-label={`View screenshot ${i + 2} fullscreen`}
              className="absolute -bottom-10 -left-8 w-[32%] h-auto object-cover rounded-2xl shadow-2xl shadow-black/40 border border-white/10 bg-background object-cover hover:scale-105 transition-transform duration-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${project.title} screenshot ${i + 2}`}
                className="inset-0 h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />
          <div className="absolute bottom-6 left-6 z-10 flex items-center gap-2">
            <span className="rounded-full border border-white/40 bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
              {badgeYear}
            </span>
            <span className="rounded-full border border-white/40 bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
              {index + 1} of {projects.length}
            </span>
            {projects.length > 1 && (
              <span className="rounded-full border border-white/40 bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                ← → navigate
              </span>
            )}
          </div>
          {hasPrev && (
            <button
              type="button"
              onClick={() => onNavigate(-1)}
              aria-label="Previous case study"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white opacity-0 group-hover:opacity-100"
            >
              <LuChevronLeft className="size-5" aria-hidden="true" />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={() => onNavigate(1)}
              aria-label="Next case study"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white opacity-0 group-hover:opacity-100"
            >
              <LuChevronRight className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-8 lg:p-12 pb-4 overscroll-behavior-contain">
          <div className="flex flex-wrap gap-2 mb-6">
            {project.technologies.map((t) => (
              <span
                key={t}
                className="rounded-md border border-border/40 bg-secondary/40 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-secondary-foreground uppercase"
              >
                {t}
              </span>
            ))}
          </div>

          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-2">
            {project.title}
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground mb-8">
            {project.description}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase tracking-wider mb-10">
            <span className="flex items-center gap-1.5">
              <LuGlobe className="h-3.5 w-3.5" aria-hidden="true" />
              {project.period}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              ~{readingTime} min read
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-10">
            <span className="font-semibold text-foreground uppercase text-[10px] tracking-wider mr-2">
              Role
            </span>
            {detail.role}
          </p>

          {detail.highlights && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
              {detail.highlights.metrics.map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-border/50 bg-secondary/30 p-4"
                >
                  <div className="text-2xl font-bold tracking-tight text-foreground">
                    {m.value}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-6">
            <SectionBlock title="The problem" Icon={LuShieldAlert}>
              <p className="text-muted-foreground leading-relaxed">
                {detail.problem}
              </p>
            </SectionBlock>

            <SectionBlock title="Constraints" Icon={LuTarget}>
              <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc pl-5">
                {detail.constraints.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </SectionBlock>

            <SectionBlock title="Decisions" Icon={LuLayers}>
              <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc pl-5">
                {detail.decisions.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </SectionBlock>

            <SectionBlock title="Trade-offs" Icon={LuTarget}>
              <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc pl-5">
                {detail.tradeoffs.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </SectionBlock>

            {detail.highlights ? null : (
              <SectionBlock title="Metrics">
                <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc pl-5">
                  {detail.metrics.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </SectionBlock>
            )}

            <SectionBlock title="What I'd do differently">
              <ul className="space-y-2 text-muted-foreground leading-relaxed list-disc pl-5">
                {detail.whatIdoDifferently.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </SectionBlock>

            <div className="rounded-xl border border-border/60 bg-secondary/30 p-6">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground mb-3">
                Outcome
              </h4>
              <p className="text-muted-foreground leading-relaxed">
                {detail.outcome}
              </p>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-border/40">
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl border border-primary bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LuArrowUpRight className="h-4 w-4" aria-hidden="true" />
              View on GitHub
            </a>
          </div>
        </div>
      </div>

      {galleryOpen && screenshots.length > 1 && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot gallery"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGalleryOpen(false);
          }}
          onWheel={(e) => e.preventDefault()}
          onTouchMove={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => setGalleryOpen(false)}
            aria-label="Close gallery"
            className="absolute top-4 right-4 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <LuX className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setGalleryIndex((i) => Math.max(0, i - 1))}
            aria-label="Previous image"
            disabled={galleryIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 p-2 text-white disabled:opacity-30 hover:bg-white/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <LuChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() =>
              setGalleryIndex((i) => Math.min(screenshots.length - 1, i + 1))
            }
            aria-label="Next image"
            disabled={galleryIndex === screenshots.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 p-2 text-white disabled:opacity-30 hover:bg-white/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <LuChevronRight className="size-5" aria-hidden="true" />
          </button>
          <div className="relative flex items-center justify-center max-w-4xl max-h-[85vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshots[galleryIndex]}
              alt={`${project.title} screenshot ${galleryIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl shadow-black/60 border border-white/10"
              loading="eager"
            />
          </div>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-xs text-white/80 tracking-wider uppercase">
            {galleryIndex + 1} of {screenshots.length}
          </p>
        </div>
      )}
    </div>
  );
}

function SectionBlock({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-accent/60 bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        {Icon && (
          <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
        )}
        <h4 className="text-sm font-semibold uppercase tracking-wider text-accent">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}
