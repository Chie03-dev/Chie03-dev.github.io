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

