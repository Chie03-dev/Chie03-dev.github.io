"use client";

import { useState } from "react";
import Link from "next/link";

import { CaseStudyDrawer } from "@/components/showcases/case-study-drawer";
import { CodeBlock } from "@/components/ui/code-block";
import { MetricBar } from "@/components/ui/metric-bar";
import { cn } from "@/lib/utils";
import type { ProjectCaseStudy } from "@/types/project";

type TabId = "overview" | "architecture" | "code";

interface ProjectCardProps {
  project: ProjectCaseStudy;
}

function GitHubIcon() {
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
      className="h-4 w-4"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 5-2 5-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 2-2.64-.5-5.36-.5-8 0C5 2 4 2 4 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 3 9c0 3.5 2 5.5 5 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function ExternalLinkIcon() {
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
      className="h-4 w-4"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Interactive case-study card. Kept as a client component because the tabbed
 * inspector and the post-mortem drawer both require local state. The static
 * summary (header, description, tags) stays above the tabs for quick scanning.
 */
export function ProjectCard({ project }: ProjectCardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview & Metrics" },
    ...(project.systemArchitectureSteps
      ? [{ id: "architecture" as TabId, label: "System Architecture" }]
      : []),
    ...(project.codeSnippet
      ? [{ id: "code" as TabId, label: "Key Code" }]
      : []),
  ];

  return (
    <article
      className={cn(
        "group flex flex-col rounded-lg border border-border bg-card p-6 transition-colors",
        "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
        "focus-within:border-primary/40",
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          {project.title}
        </h3>
        <span className="shrink-0 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          Case Study
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {project.role} &middot; {project.timeline}
      </p>

      {/* Description */}
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
        {project.description}
      </p>

      {/* Tech stack pills */}
      <ul className="mb-5 flex flex-wrap gap-2">
        {project.tags.map((tag) => (
          <li
            key={tag}
            className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground"
          >
            {tag}
          </li>
        ))}
      </ul>

      {/* Tabbed inspector */}
      <div className="mt-auto border-t border-border/60 pt-4">
        <div
          role="tablist"
          aria-label="Case study views"
          className="mb-4 flex flex-wrap gap-1"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${project.id}-tab-${tab.id}`}
              aria-controls={`${project.id}-panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${project.id}-panel-${activeTab}`}
          aria-labelledby={`${project.id}-tab-${activeTab}`}
          className="min-h-[8rem]"
        >
          {activeTab === "overview" ? (
            <div className="flex flex-col gap-4">
              {/* Metrics grid */}
              <dl className="grid grid-cols-3 gap-3 rounded-md border border-border/60 bg-muted/30 p-4">
                {project.metrics.map((metric) => (
                  <div key={metric.label} className="flex flex-col gap-1">
                    <dt className="text-xs font-medium text-muted-foreground">
                      {metric.label}
                    </dt>
                    <dd className="text-lg font-bold tracking-tight text-foreground">
                      {metric.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Before/after telemetry */}
              {project.beforeAfterMetrics?.map((metric) => (
                <MetricBar key={metric.label} metric={metric} />
              ))}

              {/* Architecture highlights */}
              <ul className="flex flex-col gap-2">
                {project.architectureHighlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <CheckIcon />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {activeTab === "architecture" && project.systemArchitectureSteps ? (
            <ol className="flex flex-col gap-4">
              {project.systemArchitectureSteps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}

          {activeTab === "code" && project.codeSnippet ? (
            <CodeBlock snippet={project.codeSnippet} />
          ) : null}
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
          {project.githubUrl ? (
            <Link
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <GitHubIcon />
              Source
            </Link>
          ) : null}
          {project.liveUrl ? (
            <Link
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLinkIcon />
              Live Case Study
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Full Engineering Post-Mortem
          </button>
        </div>
      </div>

      <CaseStudyDrawer
        project={project}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </article>
  );
}
