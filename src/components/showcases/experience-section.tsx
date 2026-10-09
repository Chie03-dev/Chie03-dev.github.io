import { cn } from "@/lib/utils";
import { getExperience, getSkillCategories } from "@/lib/experience";

/**
 * Work experience timeline and technical skills matrix.
 *
 * A Server Component. The timeline is a semantic ordered list with a vertical
 * connector and dot markers; the skills matrix groups badges by domain, with
 * primary-stack items emphasized. All styling is Tailwind CSS v4 with
 * CSS-variable tokens, and interactions are CSS-only (no client JS).
 */
export function ExperienceSection() {
  const experience = getExperience();
  const skillCategories = getSkillCategories();

  return (
    <section
      id="experience"
      className="border-b border-border/40 py-20 lg:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Experience &amp; Technical Skills
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Career milestones across mobile and full-stack engineering, and the
            stack I reach for to ship them.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-5 lg:gap-16">
          {/* Timeline */}
          <div className="lg:col-span-3">
            <h3 className="mb-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Work History
            </h3>
            <ol className="relative ml-1 border-l border-border">
              {experience.map((item) => (
                <li key={item.id} className="relative mb-10 ml-6 last:mb-0">
                  {/* Timeline dot */}
                  <span
                    aria-hidden="true"
                    className="absolute -left-[31px] top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-primary bg-background"
                  />
                  <article className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                      <h4 className="text-lg font-semibold tracking-tight text-foreground">
                        {item.role}
                      </h4>
                      <time className="shrink-0 text-xs font-medium text-muted-foreground">
                        {item.period}
                      </time>
                    </div>
                    <p className="text-sm font-medium text-primary">
                      {item.company}
                      <span className="text-muted-foreground">
                        {" "}
                        &middot; {item.location}
                      </span>
                    </p>
                    {item.description ? (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                    <ul className="mt-1 flex flex-col gap-2">
                      {item.highlights.map((highlight) => (
                        <li
                          key={highlight}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
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
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {item.skills.map((skill) => (
                        <li
                          key={skill}
                          className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                        >
                          {skill}
                        </li>
                      ))}
                    </ul>
                  </article>
                </li>
              ))}
            </ol>
          </div>

          {/* Skills matrix */}
          <div className="lg:col-span-2">
            <h3 className="mb-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Skills Matrix
            </h3>
            <div className="flex flex-col gap-8">
              {skillCategories.map((category) => (
                <div key={category.category}>
                  <h4 className="mb-3 text-sm font-semibold text-foreground">
                    {category.category}
                  </h4>
                  <ul className="flex flex-wrap gap-2">
                    {category.skills.map((skill) => (
                      <li
                        key={skill.name}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                          skill.highlight
                            ? "border-primary/50 bg-primary/10 text-foreground"
                            : "border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                      >
                        {skill.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
