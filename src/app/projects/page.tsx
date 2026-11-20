import { portfolioData } from "@/data/portfolio";
import { ArrowUpRight } from "lucide-react";

/**
 * Projects index — modern card grid linking to each case study.
 * Server Component.
 */
export default function ProjectsIndex() {
  const { projects } = portfolioData;

  return (
    <section id="projects" className="relative">
      <div className="mb-12">
        <h2 className="mb-3 text-4xl md:text-5xl font-bold tracking-tight text-foreground uppercase">
          Recent Projects
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl">
          A selection of work across Android, web, desktop, and systems support.
        </p>
      </div>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <li
            key={project.slug}
            className="group relative rounded-2xl border border-border/20 bg-card p-0 overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10"
          >
            {/* Cover image */}
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
              <img
                src={project.image}
                alt={`${project.title} cover`}
                className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <span className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                {project.period.match(/\d{4}/)?.[0] ?? project.period}
              </span>
            </div>

            <div className="p-6">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {project.technologies.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-border/40 bg-secondary/50 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-secondary-foreground uppercase"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <h3 className="mb-2 text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                {project.title}
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                {project.description}
              </p>

              <a
                href={`/projects/${project.slug}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Read case study <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
