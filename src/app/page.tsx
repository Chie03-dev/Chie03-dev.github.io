import { Hero } from "@/components/showcases/hero";
import { Navbar } from "@/components/layout/navbar";
import { ProjectsSection } from "@/components/showcases/projects-section";
import { ExperienceSection } from "@/components/showcases/experience-section";
import { GithubActivity } from "@/components/showcases/github-activity";
import { ContactFooter } from "@/components/layout/contact-footer";

export default function Home() {
  return (
    <>
      <div id="top" />
      <Navbar />
      <main id="main">
        <Hero />
        <ProjectsSection />
        <ExperienceSection />
        <GithubActivity />
      </main>
      <ContactFooter />
    </>
  );
}




