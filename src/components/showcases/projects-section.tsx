import { ProjectCard } from "@/components/showcases/project-card";
import { getFeaturedProjects } from "@/lib/projects";

/**
 * Featured projects section. A Server Component that pulls featured case
 * studies from the local content engine and renders them in a responsive grid
 * (one column on mobile, two on desktop). The id matches the /#projects
 * anchors used in the navbar and hero.
 */
export function ProjectsSection() {
  const projects = getFeaturedProjects();

  return (
    <section id="projects" className="border-b border-border/40 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Featured Projects &amp; Engineering Case Studies
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            A look under the hood: system architecture, data flow, and the
            measurable impact of the systems I have shipped.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </section>
  );
}
