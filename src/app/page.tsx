import Hero from "@/components/home/hero";
import About from "@/components/home/about";
import Projects from "@/components/home/projects";
import SkillsExperience from "@/components/home/skills-experience";
import Contact from "@/components/home/contact";
import { PageRail } from "@/components/ui/page-rail";

export default function Home() {
  return (
    <>
      <div id="top" />
      {/* pt-28 clears the fixed pill navbar (top-4 + ~52px tall); anchor offsets
          are handled globally by scroll-pt-24 on <html>. */}
      <main id="main" className="px-4 pb-20 pt-28 sm:px-6">
        {/* items-start so the left column is sized by its content instead of
            being stretched to the row height - a sticky item never gets taller
            than its own box. */}
        <div className="mx-auto grid w-full max-w-6xl items-start gap-8 lg:grid-cols-[2fr_3fr] lg:gap-12">
          {/* Left column - the caged portrait with the About stacked beneath it.
              min-w-0 because a grid item's automatic minimum size is its
              min-content, and both columns hold wide intrinsic content (the
              cage canvas, the projects scroll rail) that would otherwise push
              the track - and the page - wider than the viewport on mobile. */}
          <div className="hero-stack min-w-0">
            <Hero />
            <About />
          </div>

          {/* Right column - scrolling content; space-y-16 gives every section
              the exact same vertical rhythm. */}
          <PageRail className="min-w-0">
            <Projects />
            <SkillsExperience />
            <Contact />
          </PageRail>
        </div>
      </main>
    </>
  );
}




