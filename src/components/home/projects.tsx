import Link from "next/link";
import Image from "next/image";
import { portfolioData } from "@/data/portfolio";

export default function Projects() {
  const { projects } = portfolioData;

  return (
    <section id="projects">
      <h2 className="text-3xl font-bold tracking-tight uppercase mb-6">
        RECENT PROJECTS
      </h2>

      <div className="grid gap-6 md:grid-cols-3">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={project.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-xl border border-border/20 hover:border-primary/20 transition-all hover:-translate-y-1"
          >
            <div className="relative aspect-[4/3] w-full rounded-t-lg overflow-hidden">
              <Image
                src={project.image}
                alt={`${project.title} screenshot`}
                fill
                sizes="(min-width: 768px) 20vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{project.title}</h3>
                <span className="shrink-0 text-xs text-muted-foreground">{project.period}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {project.description}
              </p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {project.technologies.map((tech) => (
                  <span
                    key={tech}
                    className="rounded-full border border-border/40 px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tech}
                  </span>
                ))}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground uppercase">
                  View on GitHub
                </span>
                <span className="arrow-right inline-flex items-center">
                  →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}