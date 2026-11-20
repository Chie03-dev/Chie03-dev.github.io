import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  ArrowUpRight,
  Globe,
  Layers,
  ShieldAlert,
  BarChart3,
  Target,
} from "lucide-react";

import { portfolioData } from "@/data/portfolio";
import { SectionRail } from "@/components/ui/section-rail";

export const dynamic = "force-static";

export function generateStaticParams() {
  return portfolioData.projects.map((project) => ({
    slug: project.slug,
  }));
}

export const metadata: Metadata = {
  title: "Project",
};

const ICONS: Record<string, React.ElementType> = {
  globe: Globe,
  layers: Layers,
  shield: ShieldAlert,
  chart: BarChart3,
  target: Target,
  chevron: ChevronRight,
  arrowUpRight: ArrowUpRight,
};

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <span className="h-px w-8 bg-border" aria-hidden="true" />
      <h2 className="text-2xl font-bold tracking-tight text-foreground uppercase">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function DetailCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  const Icon = ICONS[icon] || Layers;
  return (
    <div className="rounded-xl border border-border/20 bg-card p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/20 bg-card p-4">
      <div className="text-3xl font-bold tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

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
    <section id={`project-${project.slug}`} className="relative">
      <SectionRail rail={false} inset={false}>
        <nav className="mb-10">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" />
            Back to projects
          </Link>
        </nav>

        <div className="mb-10 grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7">
            <div className="relative group">
              <img
                src={project.image}
                alt={`${project.title} screenshot`}
                className="w-full h-auto rounded-2xl shadow-xl shadow-black/20 transition-transform duration-500 group-hover:scale-[1.02]"
                loading="lazy"
              />
              {detail.screenshots.slice(1).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`${project.title} screenshot ${i + 2}`}
                  className="absolute -bottom-6 -left-6 w-[40%] h-auto rounded-xl shadow-xl shadow-black/20 border border-border/40 bg-background transition-transform duration-500 group-hover:scale-105 z-10"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 flex flex-col justify-between lg:justify-start">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                {project.technologies.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-border/40 bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground uppercase tracking-wider"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <h1 className="mb-4 text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                {project.title}
              </h1>
              <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
                {project.description}
              </p>

              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4" aria-hidden="true" />
                  {project.period}
                </span>
              </div>
            </div>

            <div className="mt-auto pt-8 flex flex-col gap-3">
              <a
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                View on GitHub
              </a>
            </div>
          </div>
        </div>

        {detail.highlights && (
          <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            <DetailCard title="Overview" icon="layers">
              <p className="text-muted-foreground leading-relaxed">
                {detail.highlights.subtitle}
              </p>
            </DetailCard>
            <div className="col-span-1 md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
              {detail.highlights.metrics.map((m) => (
                <StatCard key={m.label} label={m.label} value={m.value} />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-12">
          <SectionHeading title="The problem" />
          <DetailCard title="Challenge" icon="shield">
            <p className="text-muted-foreground leading-relaxed">
              {detail.problem}
            </p>
          </DetailCard>

          <SectionHeading title="Constraints" />
          <DetailCard title="Design constraints" icon="target">
            <ul className="space-y-3 text-muted-foreground leading-relaxed list-disc pl-6">
              {detail.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </DetailCard>

          <SectionHeading title="Decisions" />
          <DetailCard title="Technical decisions" icon="chart">
            <ul className="space-y-3 text-muted-foreground leading-relaxed list-disc pl-6">
              {detail.decisions.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </DetailCard>

          <SectionHeading title="Trade-offs" />
          <DetailCard title="Trade-offs considered" icon="shield">
            <ul className="space-y-3 text-muted-foreground leading-relaxed list-disc pl-6">
              {detail.tradeoffs.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </DetailCard>

          <SectionHeading title="Metrics" />
          <DetailCard title="Key results" icon="target">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {detail.metrics.map((m) => (
                <StatCard key={m} label={m} value="—" />
              ))}
            </div>
          </DetailCard>

          <SectionHeading title="What I'd do differently" />
          <DetailCard title="Future improvements" icon="layers">
            <ul className="space-y-3 text-muted-foreground leading-relaxed list-disc pl-6">
              {detail.whatIdoDifferently.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </DetailCard>

          <div className="rounded-2xl border border-border/20 bg-card p-8 md:p-12">
            <h3 className="mb-4 text-2xl font-bold tracking-tight text-foreground">
              Outcome
            </h3>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {detail.outcome}
            </p>
          </div>
        </div>
      </SectionRail>
    </section>
  );
}
