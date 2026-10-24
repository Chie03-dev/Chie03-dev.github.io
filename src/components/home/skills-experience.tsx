import { LuCheck } from "react-icons/lu";

import { CategoryIcon, RoleIcon, SkillIcon } from "@/components/icons";
import { Timeline } from "@/components/ui/timeline";
import { SectionRail } from "@/components/ui/section-rail";
import { portfolioData } from "@/data/portfolio";
import { Reveal } from "@/components/ui/reveal";
import { LuCode } from "react-icons/lu";

/**
 * Skills and experience in one section.
 *
 * Skills: a card per group, each headed by its own mark, with the individual
 * technologies as icon chips (real brand marks - see components/icons.tsx).
 *
 * Experience: a scroll-driven timeline. The rail fills as the section travels
 * up the viewport, each role's title is stuck beside its node while the role's
 * content scrolls past, and the node carries the role's own mark so the role
 * type reads before the text does. The role that is still running gets a live
 * dot on its node.
 *
 * A Server Component: the only client leaf is <Timeline>, which performs the
 * scroll-linked fill.
 */
export default function SkillsExperience() {
  const { skillGroups, experience } = portfolioData;

  return (
    <section id="skills">
      {/* One rail for the whole section: the skills cards and the experience
          timeline hang off the same spine, so the rail runs unbroken from the
          section heading down to the last role. */}
      <SectionRail rail={false} icon={<LuCode className="size-4" />}>
        <h2 className="mb-6 text-3xl font-bold tracking-tight uppercase">
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
        <Timeline
          railless
          data={experience.map((exp) => {
                        return {
              title: exp.period,
              node: (
                <span className="relative flex h-full w-full items-center justify-center">
                  <RoleIcon position={exp.position} className="size-4" />
                  
                </span>
              ),
              content: (
                <article className="rounded-2xl border border-border/60 bg-card/40 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h4 className="text-lg font-semibold tracking-tight">
                      {exp.position}
                    </h4>
                    <span className="text-sm">
                      <span className="text-primary">{exp.company}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        &middot; {exp.location}
                      </span>
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1.5">
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
              ),
            };
          })}
        />
      </SectionRail>
    </section>
  );
}
