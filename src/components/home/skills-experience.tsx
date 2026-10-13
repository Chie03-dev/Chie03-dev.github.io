import { LuCheck } from "react-icons/lu";

import { CategoryIcon, RoleIcon, SkillIcon } from "@/components/icons";
import { portfolioData } from "@/data/portfolio";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

/**
 * Skills and experience in one section.
 *
 * Skills: a card per group, each headed by its own mark, with the individual
 * technologies as icon chips (real brand marks - see components/icons.tsx).
 *
 * Experience: a vertical timeline. The rail draws itself in as the section
 * travels up the viewport (native CSS scroll-driven animation, no JS), each
 * role card staggers in on reveal, and the node carries the role's own mark so
 * the role type reads before the text does. The role that is still running gets
 * a live dot on its node.
 *
 * A Server Component: the only client leaf is <Reveal>, which is what performs
 * the staggered entry.
 */
export default function SkillsExperience() {
  const { skillGroups, experience } = portfolioData;

  return (
    <section id="skills">
      <h2 className="text-3xl font-bold tracking-tight uppercase mb-6">
        SKILLS &amp; EXPERIENCE
      </h2>

      {/* ---- Skills ---- */}
      <h3 className="mb-4 text-xl font-semibold">Skills</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {skillGroups.map((group, i) => (
          <Reveal key={group.category} delay={i * 50} className="h-full">
            <article className="group h-full rounded-2xl border border-border/60 bg-card/40 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <CategoryIcon category={group.category} className="size-4.5" />
                </span>
                <h4 className="text-sm font-semibold tracking-tight">
                  {group.category}
                </h4>
                <span className="ml-auto text-xs text-muted-foreground">
                  {group.items.length}
                </span>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <li
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/50 px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    <SkillIcon
                      name={item}
                      group={group.category}
                      className="size-3.5 shrink-0"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        ))}
      </div>

      {/* ---- Experience ---- */}
      <h3 className="mt-12 mb-6 text-xl font-semibold">Experience</h3>
      <div className="relative">
        {/* Rail. Drawn as a gradient so it fades out rather than stopping on a
            hard edge, and stretched in by the scroll-driven animation in
            globals.css when the browser supports it. */}
        <span
          aria-hidden="true"
          className="timeline-rail absolute left-5 top-2 bottom-2 w-px bg-gradient-to-b from-primary/60 via-border to-transparent"
        />
        <ol className="relative space-y-4">
          {experience.map((exp, i) => {
            const isCurrent = exp.period.toLowerCase().includes("present");
            return (
              <li key={exp.id}>
                <Reveal
                  delay={i * 90}
                  className="relative pl-14 sm:pl-16"
                >
                  {/* Node on the rail, holding the role's own mark. */}
                  <span
                    className={cn(
                      "absolute left-0 top-3 flex size-10 items-center justify-center rounded-xl border bg-card shadow-sm transition-colors",
                      isCurrent
                        ? "border-primary/50 text-primary"
                        : "border-border/60 text-primary/80",
                    )}
                  >
                    <RoleIcon position={exp.position} className="size-4" />
                    {isCurrent && (
                      <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                        <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                      </span>
                    )}
                  </span>

                  <article className="rounded-2xl border border-border/60 bg-card/40 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <h4 className="font-semibold tracking-tight">
                        {exp.position}
                      </h4>
                      <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {exp.period}
                      </span>
                    </div>
                    <p className="mb-3 text-sm">
                      <span className="text-primary">{exp.company}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        &middot; {exp.location}
                      </span>
                    </p>
                    <ul className="space-y-1.5">
                      {exp.description.map((line, j) => (
                        <li
                          key={j}
                          className="flex gap-2 text-sm text-muted-foreground"
                        >
                          <LuCheck
                            className="mt-0.5 size-3.5 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
