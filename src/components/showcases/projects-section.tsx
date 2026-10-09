"use client";

import { useState } from "react";

import { ProjectCard } from "@/components/showcases/project-card";
import { SpotlightCard } from "@/components/ui/spotlight-card";
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
 * Featured projects section with live tag filtering. A client component that
 * owns the active filter state and re-renders the grid without a page reload.
 * Cards replay a subtle entry animation on filter change and respect reduced
 * motion. The id matches the /#projects anchors used in the navbar and hero.
 */
export function ProjectsSection() {
  const projects = getFeaturedProjects();
  const [active, setActive] = useState<FilterId>("all");
  const visible = projects.filter((project) => matchesFilter(project, active));

  return (
    <section id="projects" className="border-b border-border/40 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-8 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Featured Projects &amp; Engineering Case Studies
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            A look under the hood: system architecture, data flow, and the
            measurable impact of the systems I have shipped.
          </p>
        </div>

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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {visible.map((project) => (
            <SpotlightCard
              key={`${active}-${project.id}`}
              className="animate-card-in motion-reduce:animate-none"
            >
              <ProjectCard project={project} />
            </SpotlightCard>
          ))}
        </div>
      </div>
    </section>
  );
}

