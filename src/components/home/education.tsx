import { portfolioData } from "@/data/portfolio";
import { SectionRail } from "@/components/ui/section-rail";
import { LuSchool } from "react-icons/lu";

export default function Education() {
  const { education } = portfolioData;

  return (
    <section id="education">
      <SectionRail rail={false} icon={<LuSchool className="size-4" />}>
        <div className="flex items-end gap-2">
          <h2 className="text-3xl font-bold tracking-tight uppercase mb-0">
            EDUCATION
          </h2>
          <span className="h-1 w-[40px] rounded-full bg-accent" />
        </div>
        <div className="space-y-4">
          {education.map((edu) => (
            <article
              key={edu.id}
              className="rounded-2xl border border-border/60 bg-card/40 dark:bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5"
            >
              <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-lg font-semibold tracking-tight">
                  {edu.degree}
                </h3>
                <span className="text-sm text-muted-foreground">{edu.period}</span>
              </div>
              <p className="text-sm">
                <span className="text-primary">{edu.school}</span>
                <span className="text-muted-foreground">
                  {" "}
                  &middot; {edu.location}
                </span>
              </p>
              {edu.description && edu.description.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {edu.description.map((line, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </SectionRail>
    </section>
  );
}
