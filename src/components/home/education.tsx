import { portfolioData } from "@/data/portfolio";
import { SectionRail } from "@/components/ui/section-rail";
import { LuSchool } from "react-icons/lu";

export default function Education() {
  const { education } = portfolioData;

  return (
    <section id="education">
      <SectionRail rail={false} icon={<LuSchool className="size-4" />}>
        <h2 className="mb-6 text-3xl font-bold tracking-tight uppercase">
          EDUCATION
        </h2>
        <div className="space-y-4">
          {education.map((edu) => (
            <article
              key={edu.id}
              className="rounded-2xl border border-border/60 bg-card/40 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
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
