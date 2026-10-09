/**
 * Data model for engineering case studies / project post-mortems.
 */

/** A single quantifiable impact figure shown on a project card. */
export interface ProjectMetric {
  label: string;
  value: string;
}

/** A before/after comparison rendered as a visual telemetry bar. */
export interface BeforeAfterMetric {
  label: string;
  before: string;
  after: string;
  reductionPercentage: number;
}

/** A minimal code sample with lightweight syntax highlighting. */
export interface CodeSnippet {
  language: string;
  filename: string;
  code: string;
}

/** A single ordered step in a system architecture sequence. */
export interface ArchitectureStep {
  title: string;
  description: string;
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
  beforeAfterMetrics?: BeforeAfterMetric[];
  codeSnippet?: CodeSnippet;
  systemArchitectureSteps?: ArchitectureStep[];
  githubUrl?: string;
  liveUrl?: string;
  featured: boolean;
}
