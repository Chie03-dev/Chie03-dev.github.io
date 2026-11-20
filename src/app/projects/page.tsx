import { portfolioData } from "@/data/portfolio";

/**
 * Projects index — lists every project with a link to its detail page.
 * Server Component.
 */
export default function ProjectsIndex() {
  const { projects } = portfolioData;

  return (
    <section id="projects">
      <h2 className="mb-6 text-3xl font-bold tracking-tight uppercase">
        Recent Projects
      </h2>
      <p className="mb-8 text-lg text-muted-foreground">
        A selection of work across Android, web, desktop, and systems support.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <li
            key={project.slug}
            className="rounded-xl border border-border/20 bg-card p-6 hover:border-primary/30 transition-colors"
          >
            <h3 className="mb-2 text-xl font-semibold tracking-tight">
              {project.title}
            </h3>
            <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
              {project.description}
            </p>
            <ul className="mb-4 flex flex-wrap gap-2">
              {project.technologies.map((t) => (
                <li
                  key={t}
                  className="rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold tracking-wider text-secondary-foreground uppercase"
                >
                  {t}
                </li>
              ))}
            </ul>
            <a
              href={`/projects/${project.slug}`}
              className="inline-flex items-center rounded-md border border-border/40 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              Read case study
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
