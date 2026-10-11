import { Hero } from "@/components/showcases/hero";
import { Navbar } from "@/components/layout/navbar";
import { ProjectsSection } from "@/components/showcases/projects-section";
import { ExperienceSection } from "@/components/showcases/experience-section";
import { KeySection } from "@/components/showcases/key-section";
import { LifeCard } from "@/components/showcases/life-card";
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
        <KeySection />
        <LifeCard />
      </main>
      <ContactFooter />
    </>
  );
}




