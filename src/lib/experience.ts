import type { ExperienceItem, SkillCategory } from "@/types/experience";

/**
 * Structured content engine for work experience and the skills matrix.
 *
 * Synchronous and local, so it is directly callable from Server Components.
 * The data below is representative sample content for a senior engineer; swap
 * it for real history when wiring up the live profile.
 */

const EXPERIENCE: ExperienceItem[] = [
  {
    id: "freelance-software-developer",
    role: "Freelance Software Developer",
    company: "Freelance",
    location: "Remote | Mindanao, Philippines",
    period: "01/2023 - Present",
    highlights: [
      "Rebuilt legacy frontend components for a school management system and two municipal portals using Next.js, React, Node.js, and Django.",
      "Eliminated recurring portal downtime and reduced initial load times through optimized server side rendering and asset compression.",
      "Defined REST API endpoint naming conventions and data flow contracts to streamline frontend to database integration.",
    ],
    skills: [
      "Next.js",
      "React",
      "Node.js",
      "TypeScript",
      "Django",
      "REST APIs",
      "PostgreSQL",
    ],
  },
  {
    id: "drainwiz-intern",
    role: "Software & Systems Engineering Intern",
    company: "Drainwiz Computer System",
    location: "Dipolog City, Philippines",
    period: "07/2025 - 08/2025",
    highlights: [
      "Collaborated with senior engineers on client web application builds using HTML, CSS, JavaScript, PHP, and MySQL.",
      "Diagnosed and resolved hardware, software, and network configuration issues across Windows and Linux environments.",
    ],
    skills: [
      "PHP",
      "JavaScript",
      "MySQL",
      "Linux Admin",
      "Windows Server",
      "Hardware Troubleshooting",
    ],
  },
  {
    id: "virtual-buddy-helpdesk",
    role: "Help Desk Technician",
    company: "Virtual Buddy",
    location: "Dipolog City, Philippines",
    period: "03/2022 - 05/2022",
    highlights: [
      "Provided technical hardware and software support for users in a call center environment.",
      "Logged, tracked, and escalated technical issues using structured documentation and ticketing practices.",
    ],
    skills: [
      "Help Desk Support",
      "Hardware Repair",
      "Network Diagnostics",
      "Active Directory",
      "Documentation",
    ],
  },
];

const SKILL_CATEGORIES: SkillCategory[] = [
  {
    category: "Mobile & Native Development",
    skills: [
      { name: "Kotlin", highlight: true },
      { name: "Jetpack Compose", highlight: true },
      { name: "Room SQLite", highlight: true },
      { name: "MVVM", highlight: true },
      { name: "CameraX", highlight: true },
      { name: "Google ML Kit", highlight: true },
      { name: "Android SDK", highlight: true },
    ],
  },
  {
    category: "Web & Full-Stack",
    skills: [
      { name: "Next.js 15", highlight: true },
      { name: "React 19", highlight: true },
      { name: "TypeScript", highlight: true },
      { name: "Tailwind CSS v4", highlight: true },
      { name: "Node.js", highlight: true },
      { name: "Electron", highlight: true },
      { name: "REST APIs", highlight: true },
      { name: "WebSockets", highlight: true },
    ],
  },
  {
    category: "Databases & Systems",
    skills: [
      { name: "PostgreSQL" },
      { name: "SQLite" },
      { name: "MySQL" },
      { name: "Cloudflare Workers" },
      { name: "Linux/Windows OS" },
      { name: "Git/GitHub" },
    ],
  },
];

/** All work-experience entries, most recent first. */
export function getExperience(): ExperienceItem[] {
  return EXPERIENCE;
}

/** All skill categories for the technical skills matrix. */
export function getSkillCategories(): SkillCategory[] {
  return SKILL_CATEGORIES;
}
