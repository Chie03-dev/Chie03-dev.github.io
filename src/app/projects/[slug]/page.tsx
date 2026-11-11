import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { portfolioData } from "@/data/portfolio";
import { SectionRail } from "@/components/ui/section-rail";

export const dynamic = "force-static";

/**
 * Pre-render every project slug at build time — required for static export
 * (`output: "export"`).
 */
export function generateStaticParams() {
  return portfolioData.projects.map((project) => ({
    slug: project.slug,
  }));
}

export const metadata: Metadata = {
  title: "Project",
};

/**
 * Project detail page — the case study behind each card. Server Component.
 */
export default async function ProjectDetail({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  const project = portfolioData.projects.find((p) => p.slug === slug);

  if (!project) {
    notFound();
  }

  const { detail } = project;

  return (
    <section id={`project-${project.slug}`}>
      <SectionRail rail={false} inset={false}>
        <nav className="mb-8">
          <Link
            href="/projects"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            ← Back to projects
          </Link>
        </nav>

        <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:gap-8">
          <div className="lg:w-[40%]">
            {/* eslint-disable @next/next/no-img-element */}
            <img
              src={project.image}
              alt={`${project.title} screenshot`}
              className="w-full h-auto rounded-xl shadow-lg"
              loading="lazy"
            />
            {detail.screenshots.slice(1).map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`${project.title} screenshot ${i + 2}`}
                className="mt-4 w-full h-auto rounded-xl shadow-lg"
                loading="lazy"
              />
            ))}
            {/* eslint-enable @next/next/no-img-element */}
          </div>
          <div className="lg:w-[60%] mt-6 lg:mt-0">
            <h1 className="mb-4 text-4xl font-bold tracking-tight">
              {project.title}
            </h1>
            <p className="mb-6 text-lg text-muted-foreground">
              {project.description}
            </p>

            <div className="mb-8 grid gap-2 sm:grid-cols-2">
              <span className="px-3 py-1 rounded-full border border-border/40 bg-background text-xs font-medium">
                {project.period}
              </span>
              <span className="px-3 py-1 rounded-full border border-border/40 bg-background text-xs font-medium">
                {detail.role}
              </span>
            </div>

            <ul className="mb-8 flex flex-wrap gap-2">
              {project.technologies.map((t) => (
                <li
                  key={t}
                  className="rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold tracking-wider text-secondary-foreground uppercase"
                >
                  {t}
                </li>
              ))}
            </ul>

            <div className="flex gap-4">
              <a
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border/40 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                View on GitHub →
              </a>
            </div>
          </div>
        </div>

        <h2 className="mb-6 text-3xl font-bold tracking-tight uppercase">
          The problem
        </h2>
        <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
          {detail.problem}
        </p>

        <h2 className="mb-6 text-3xl font-bold tracking-tight uppercase">
          Constraints
        </h2>
        <ul className="mb-8 space-y-3 text-lg leading-relaxed text-muted-foreground list-disc pl-6">
          {detail.constraints.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <h2 className="mb-6 text-3xl font-bold tracking-tight uppercase">
          Decisions
        </h2>
        <ul className="mb-8 space-y-3 text-lg leading-relaxed text-muted-foreground list-disc pl-6">
          {detail.decisions.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>

        <h2 className="mb-6 text-3xl font-bold tracking-tight uppercase">
          Trade-offs
        </h2>
        <ul className="mb-8 space-y-3 text-lg leading-relaxed text-muted-foreground list-disc pl-6">
          {detail.tradeoffs.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <h2 className="mb-6 text-3xl font-bold tracking-tight uppercase">
          Metrics
        </h2>
        <ul className="mb-8 space-y-3 text-lg leading-relaxed text-muted-foreground list-disc pl-6">
          {detail.metrics.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>

        <h2 className="mb-6 text-3xl font-bold tracking-tight uppercase">
          What I&#39;d do differently
        </h2>
        <ul className="mb-8 space-y-3 text-lg leading-relaxed text-muted-foreground list-disc pl-6">
          {detail.whatIdoDifferently.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>

        <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
          <strong>Outcome:</strong> {detail.outcome}
        </p>
      </SectionRail>
    </section>
  );
}
