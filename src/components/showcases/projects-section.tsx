"use client";

import { useState } from "react";

import { CaseStudyDrawer } from "@/components/showcases/case-study-drawer";
import { NotchedProjectCard } from "@/components/ui/notched-project-card";
import { Reveal } from "@/components/ui/reveal";
import { getFeaturedProjects } from "@/lib/projects";
import { cn } from "@/lib/utils";
import type { ProjectCaseStudy } from "@/types/project";

type FilterId = "all" | "android" | "fullstack" | "offline";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "android", label: "Android / Kotlin" },
  { id: "fullstack", label: "Full-Stack" },
  { id: "offline", label: "Offline Systems" },
];

const ANDROID_TAGS = [
  "kotlin",
  "jetpack compose",
  "java",
  "camerax",
  "google ml kit",
  "room sqlite",
  "mvvm",
  "mpandroidchart",
];
const FULLSTACK_TAGS = [
  "next.js 15",
  "react 19",
  "typescript",
  "node.js",
  "electron",
  "cloudflare workers",
  "tailwind css v4",
  "framer motion",
  "websockets",
  "postgresql",
];
const OFFLINE_TAGS = ["electron", "websockets"];

function matchesFilter(project: ProjectCaseStudy, filter: FilterId): boolean {
  if (filter === "all") return true;
  const tags = project.tags.map((tag) => tag.toLowerCase());
  const set =
    filter === "android"
      ? ANDROID_TAGS
      : filter === "fullstack"
        ? FULLSTACK_TAGS
        : OFFLINE_TAGS;
  return tags.some((tag) => set.includes(tag));
}

/**
 * Cover art per project. Presentation data kept beside the section so the
 * ProjectCaseStudy domain type stays image-free.
 */
const PROJECT_COVERS: Record<string, { image: string }> = {
  "lan-quiz-system": { image: "/projects/Quiz.webp" },
  "mobile-pos-inventory": { image: "/projects/mobilepos.webp" },
  "barangay-demo-services-portal": { image: "/projects/barangay.webp" },
};

/** Derive the badge year from the leading date in the timeline string. */
function coverBadge(project: ProjectCaseStudy): string | undefined {
  const match = project.timeline.match(/(\d{4})/);
  return match ? match[1] : undefined;
}

/**
 * Featured projects section with live tag filtering. A client component that
 * owns the active filter and the open case-study drawer, and re-renders the
 * grid without a page reload. Cards reveal on scroll (and replay when the
 * filter key remounts) and respect reduced motion. The id matches the
 * /#projects anchors used in the navbar and hero.
 */
export function ProjectsSection() {
  const projects = getFeaturedProjects();
  const [active, setActive] = useState<FilterId>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const visible = projects.filter((project) => matchesFilter(project, active));

  return (
    <section
      id="projects"
      className="relative isolate overflow-hidden border-b border-border/40 py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <Reveal className="mb-8 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Projects
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Stuff I have built.
          </p>
        </Reveal>

        {/* Filter bar */}
        <div
          role="group"
          aria-label="Filter projects"
          className="mb-8 flex flex-wrap gap-2"
        >
          {FILTERS.map((filter) => {
            const isActive = filter.id === active;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActive(filter.id)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8">
          {visible.map((project, index) => {
            const cover = PROJECT_COVERS[project.id];
            return (
              <Reveal
                key={`${active}-${project.id}`}
                className="h-full"
                delay={(index % 3) * 90}
              >
                <NotchedProjectCard
                  title={project.title}
                  description={project.description}
                  image={cover?.image ?? "/projects/barangay.webp"}
                  imageAlt={`${project.title} cover`}
                  badge={coverBadge(project)}
                  tags={project.tags}
                  onOpen={() => setOpenId(project.id)}
                />
              </Reveal>
            );
          })}
        </div>

        {/* Post-mortem drawer for the open card */}
        {visible.map((project) =>
          openId === project.id ? (
            <CaseStudyDrawer
              key={project.id}
              project={project}
              open
              onClose={() => setOpenId(null)}
            />
          ) : null,
        )}
      </div>
    </section>
  );
}

