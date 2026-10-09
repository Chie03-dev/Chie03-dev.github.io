"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { CodeBlock } from "@/components/ui/code-block";
import { MetricBar } from "@/components/ui/metric-bar";
import type { ProjectCaseStudy } from "@/types/project";

interface CaseStudyDrawerProps {
  project: ProjectCaseStudy;
  open: boolean;
  onClose: () => void;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

/**
 * Slide-over "Full Engineering Post-Mortem" drawer. Handles Escape to close,
 * a Tab focus trap scoped to the panel, body scroll lock, and focus restore on
 * unmount. All deep-dive content is derived from the project's case-study data.
 */
export function CaseStudyDrawer({ project, open, onClose }: CaseStudyDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const focusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    focusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`${project.title} case study`}
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-card/95 p-6 backdrop-blur">
          <div>
            <p className="mb-1 text-xs font-semibold text-primary">
              Full Engineering Post-Mortem
            </p>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {project.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {project.role} &middot; {project.timeline}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close case study"
            className="shrink-0 rounded-full border border-border bg-background p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
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
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-8 p-6">
          <section>
            <SectionLabel>Problem Context</SectionLabel>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {project.description}
            </p>
            {project.beforeAfterMetrics ? (
              <div className="mt-4 flex flex-col gap-3">
                {project.beforeAfterMetrics.map((metric) => (
                  <MetricBar key={metric.label} metric={metric} />
                ))}
              </div>
            ) : null}
          </section>

          {project.systemArchitectureSteps ? (
            <section>
              <SectionLabel>System Architecture</SectionLabel>
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
            </section>
          ) : null}

          <section>
            <SectionLabel>System Trade-Offs</SectionLabel>
            <ul className="flex flex-col gap-2">
              {project.architectureHighlights.map((highlight) => (
                <li
                  key={highlight}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <SectionLabel>Tech Stack Rationale</SectionLabel>
            <ul className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </section>

          {project.codeSnippet ? (
            <section>
              <SectionLabel>Key Code</SectionLabel>
              <CodeBlock snippet={project.codeSnippet} />
            </section>
          ) : null}

          <section>
            <SectionLabel>Source Code Links</SectionLabel>
            <div className="flex flex-wrap gap-3">
              {project.githubUrl ? (
                <Link
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  View Source
                </Link>
              ) : null}
              {project.liveUrl ? (
                <Link
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Live Case Study
                </Link>
              ) : null}
              {!project.githubUrl && !project.liveUrl ? (
                <p className="text-sm text-muted-foreground">
                  Source is not publicly available for this case study.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}