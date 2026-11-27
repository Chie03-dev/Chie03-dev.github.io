import { LuStar } from "react-icons/lu";

import { portfolioData } from "@/data/portfolio";
import { SectionRail } from "@/components/ui/section-rail";

export default function Testimonials() {
  const { testimonials } = portfolioData;

  return (
    <section id="testimonials">
      <SectionRail rail={false} icon={<LuStar className="size-4" />}>
        <div className="flex items-end gap-2">
          <h2 className="text-3xl font-bold tracking-tight uppercase mb-0">
            Testimonials
          </h2>
          <span className="h-1 w-[40px] rounded-full bg-accent" />
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <article
              key={t.id}
              className="rounded-2xl border border-border/60 bg-card/40 dark:bg-card p-6 transition-all hover:-translate-y-1 hover:border-accent/60 hover:shadow-lg hover:shadow-accent/10"
            >
              <blockquote className="mb-4 text-sm leading-relaxed text-muted-foreground">
                “{t.content}”
              </blockquote>
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-secondary text-xs font-medium text-secondary-foreground">
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </span>
                <div>
                  <span className="block text-sm font-semibold text-foreground">
                    {t.name}
                  </span>
                  <span className="block text-[11px] text-muted-foreground uppercase tracking-wider">
                    {t.role}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </SectionRail>
    </section>
  );
}
