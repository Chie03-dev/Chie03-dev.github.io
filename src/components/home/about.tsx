import { Reveal } from "@/components/ui/reveal";
import { portfolioData } from "@/data/portfolio";

/**
 * Every skill name in the stack, longest first so "JavaScript" claims a run of
 * text before "Java" can, and regex-escaped because the names contain dots,
 * slashes and ampersands. Word boundaries keep matches whole, so "SQL" never
 * lights up inside "SQLite".
 */
const SKILL_TERMS = [
  ...new Set(portfolioData.skillGroups.flatMap((group) => group.items)),
]
  .sort((a, b) => b.length - a.length)
  .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const TERM_PATTERN = new RegExp(`\\b(${SKILL_TERMS.join("|")})\\b`, "gi");

/**
 * Renders copy with the stack's own skill names lit up, so the keywords in the
 * About read as part of the stack rather than as flat text. Splitting on a
 * single capture group interleaves the hits, so the odd indexes are the matches.
 */
function StackHighlight({ text }: { text: string }) {
  const parts = text.split(TERM_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span
            key={i}
            className="rounded-md bg-primary/10 px-1 font-medium text-primary"
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * About block, stacked under the hero portrait in the left column.
 *
 * The description is the centrepiece here rather than the stat strip that used
 * to sit under it, so it is set editorially: the first sentence opens as a
 * lead at a larger weight behind an accent rule, the supporting sentences
 * follow smaller and muted, and the skill names inside the copy are highlighted
 * so the bio and the Skills section read as one story. Each part staggers in on
 * reveal.
 */
export default function About() {
  const { name, bio, headline, intro } = portfolioData;

  const sentences = intro.split(/(?<=[.!?])\s+/);
  const lead = sentences[0] ?? intro;
  const rest = sentences.slice(1).join(" ");

  return (
    <section id="about">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px w-8 bg-primary/60" aria-hidden="true" />
        <h2 className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">
          About me
        </h2>
      </div>

      <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">&bull; {bio}</p>

      <h3 className="mt-5 bg-gradient-to-br from-foreground to-foreground/55 bg-clip-text text-4xl font-bold tracking-tight uppercase text-transparent">
        {headline}
      </h3>

      <Reveal className="mt-6 border-l-2 border-primary/60 pl-4">
        <p className="text-xl font-medium leading-snug text-foreground">
          <StackHighlight text={lead} />
        </p>
      </Reveal>

      {rest && (
        <Reveal delay={90} className="mt-4">
          <p className="text-base leading-relaxed text-muted-foreground">
            <StackHighlight text={rest} />
          </p>
        </Reveal>
      )}
    </section>
  );
}
