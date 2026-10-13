/**
 * Central site configuration. Shared by metadata, the web manifest, robots,
 * the contact footer, and the command palette to avoid duplicated literals.
 */
export const site = {
  name: "Alchie O. Andilab",
  role: "Software Developer",
  description:
    "Computer Science graduate with experience in Android app development, web applications, and technical support.",
  url: "https://chie03-dev.github.io",
  email: "alchieandilab2003@gmail.com",
  github: "https://github.com/Chie03-dev",
  githubUsername: "Chie03-dev",
  linkedin: "https://www.linkedin.com/in/alchieandilab",
  // Exact case matters on the GitHub Pages host (case-sensitive filesystem).
  resumeUrl: "/Resume.pdf",
} as const;
