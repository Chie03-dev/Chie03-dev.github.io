/**
 * Data models for work experience and the technical skills matrix.
 */

/** A single role in the professional timeline. */
export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  location: string;
  period: string;
  description?: string;
  highlights: string[];
  skills: string[];
}

/** A single skill, optionally flagged as part of the primary stack. */
export interface Skill {
  name: string;
  highlight?: boolean;
}

/** A group of skills sharing a technical domain. */
export interface SkillCategory {
  category: string;
  skills: Skill[];
}
