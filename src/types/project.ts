/**
 * Data model for engineering case studies / project post-mortems.
 */

/** A single quantifiable impact figure shown on a project card. */
export interface ProjectMetric {
  label: string;
  value: string;
}

/** A deep-dive engineering case study for a featured project. */
export interface ProjectCaseStudy {
  id: string;
  slug: string;
  title: string;
  description: string;
  role: string;
  timeline: string;
  tags: string[];
  metrics: ProjectMetric[];
  architectureHighlights: string[];
  githubUrl?: string;
  liveUrl?: string;
  featured: boolean;
}
