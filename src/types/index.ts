/**
 * Global TypeScript definitions shared across the portfolio.
 */

/** A single MDX case-study / post-mortem entry parsed from src/content. */
export interface Post {
  slug: string;
  title: string;
  summary: string;
  date: string;
  tags?: string[];
}

/** A primary navigation link used by the header. */
export interface NavItem {
  label: string;
  href: string;
}

/** Social media link for profile icons. */
export interface SiteSocial {
  name: string;
  url: string;
  icon: string; // Could be used to map to actual icon components
}

