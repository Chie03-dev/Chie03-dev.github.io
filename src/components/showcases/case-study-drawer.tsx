"use client";

import { useState, useEffect } from "react";

import { cn } from "@/lib/utils";
import type { ProjectCaseStudy } from "@/types/project";

interface CaseStudyDrawerProps {
  project: ProjectCaseStudy;
  open: boolean;
  onClose: () => void;
  className?: string;
}

export function CaseStudyDrawer({
  project,
  open,
  onClose,
  className,
}: CaseStudyDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      setMounted(true);
    } else {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  if (!mounted || !open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-background shadow-2xl ring-1 ring-border",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={`Case study: ${project.title}`}
      >
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {project.title}
            </h2>
            <span className="text-xs text-muted-foreground">{project.role}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close case study"
            className="rounded-full bg-background p-2 ring-1 ring-border transition hover:bg-muted hover:ring-ring"
          >
            <svg
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-6 space-y-8">
          <p>{project.description}</p>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <svg
                className="size-4 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">{project.timeline}</p>
          </div>

          <section>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Key Metrics
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {project.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg border border-border/40 p-4"
                >
                  <dt className="text-xs text-muted-foreground">{metric.label}</dt>
                  <dd className="mt-1 text-lg font-semibold text-foreground">
                    {metric.value}
                  </dd>
                </div>
              ))}
            </div>
          </section>

          {project.architectureHighlights.length > 0 && (
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                System Architecture
              </h3>
              <ol className="space-y-6">
                {project.systemArchitectureSteps?.map((step, idx) => (
                  <li key={idx} className="relative pl-6">
                    <span className="absolute -left-2 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {idx + 1}
                    </span>
                    <h4 className="mb-1 text-sm font-semibold text-foreground">
                      {step.title}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {project.codeSnippet && (
            <section className="overflow-hidden rounded-lg border border-border/40">
              <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400/80" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <span className="h-3 w-3 rounded-full bg-green-400/80" />
                  <span className="ml-2 text-xs text-muted-foreground">
                    {project.codeSnippet.filename}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {project.codeSnippet.language}
                </span>
              </div>
              <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-foreground">
                {project.codeSnippet.code}
              </pre>
            </section>
          )}

          {(project.githubUrl || project.liveUrl) && (
            <div className="flex flex-wrap gap-3">
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border/40 px-4 py-2 text-sm transition hover:border-primary/40 hover:text-primary"
                >
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Source
                </a>
              )}
              {project.liveUrl && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border/40 px-4 py-2 text-sm transition hover:border-primary/40 hover:text-primary"
                >
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  Live Demo
                </a>
              )}
            </div>
          )}
        </div>
        <div className="border-t border-border/40 px-6 py-4 text-center text-xs text-muted-foreground">
          Press Escape or click outside to close
        </div>
      </div>
    </>
  );
}