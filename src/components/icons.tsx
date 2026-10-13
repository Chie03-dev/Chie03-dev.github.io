import type { IconType } from "react-icons";
import {
  SiAndroidstudio,
  SiCloudflareworkers,
  SiDjango,
  SiElectron,
  SiFirebase,
  SiFramer,
  SiGithub,
  SiGoogle,
  SiGradle,
  SiHtml5,
  SiJetpackcompose,
  SiJavascript,
  SiJest,
  SiKotlin,
  SiMysql,
  SiN8N,
  SiNextdotjs,
  SiNodedotjs,
  SiPhp,
  SiPostgresql,
  SiPython,
  SiReact,
  SiSqlite,
  SiTailwindcss,
  SiTypescript,
  SiVitest,
  SiZapier,
} from "react-icons/si";
import {
  LuBot,
  LuBrainCircuit,
  LuBriefcase,
  LuCamera,
  LuCloud,
  LuCloudCog,
  LuCode,
  LuCoffee,
  LuComponent,
  LuCpu,
  LuDatabase,
  LuDatabaseZap,
  LuFlaskConical,
  LuGraduationCap,
  LuHeadset,
  LuKanban,
  LuLaptop,
  LuListChecks,
  LuMonitor,
  LuMonitorCog,
  LuNetwork,
  LuPresentation,
  LuRadio,
  LuServer,
  LuSmartphone,
  LuSparkles,
  LuUsers,
  LuWebhook,
  LuWrench,
} from "react-icons/lu";

/**
 * Icon registry for the skills and experience sections.
 *
 * Brand marks come from Simple Icons (CC0) and the line glyphs from Lucide
 * (ISC), both tree-shaken in through react-icons, so every icon is a real
 * open-source asset rather than a hand-drawn or emoji stand-in. Both sets draw
 * in `currentColor`, so the glyphs inherit the site's light/dark tokens instead
 * of shipping hard-coded brand colours that disappear on one of the themes.
 *
 * Lookups fall back so nothing ever renders blank: an unknown skill takes its
 * group's icon, an unknown group or role takes the generic default.
 */

/** Per-skill marks, keyed by the exact string in `portfolioData.skillGroups`. */
const SKILL_ICONS: Record<string, IconType> = {
  // Languages
  Kotlin: SiKotlin,
  // Simple Icons dropped the Java mark (trademark request), so the coffee cup
  // - the language's own mascot - stands in from the line set.
  Java: LuCoffee,
  TypeScript: SiTypescript,
  JavaScript: SiJavascript,
  Python: SiPython,
  PHP: SiPhp,
  "HTML/CSS": SiHtml5,
  SQL: LuDatabase,

  // Mobile
  "Jetpack Compose": SiJetpackcompose,
  Room: LuDatabaseZap,
  MVVM: LuComponent,
  CameraX: LuCamera,
  "Google ML Kit": LuBrainCircuit,
  "Android Studio": SiAndroidstudio,
  Gradle: SiGradle,

  // Web and Desktop
  React: SiReact,
  "Next.js": SiNextdotjs,
  "Tailwind CSS": SiTailwindcss,
  "Framer Motion": SiFramer,
  "Node.js": SiNodedotjs,
  Electron: SiElectron,
  Django: SiDjango,
  "REST APIs": LuWebhook,
  "WebSockets / SSE": LuRadio,

  // Databases
  PostgreSQL: SiPostgresql,
  SQLite: SiSqlite,
  MySQL: SiMysql,
  "Cloud Firestore": SiFirebase,

  // Testing
  Vitest: SiVitest,
  Jest: SiJest,
  "UI automation scripts": LuBot,

  // Cloud and Automation
  "Cloudflare Workers": SiCloudflareworkers,
  AWS: LuCloudCog,
  Zapier: SiZapier,
  n8n: SiN8N,
  "Google Workspace": SiGoogle,
  "Microsoft Office": LuPresentation,

  // Systems and Support
  "Windows & Linux": LuMonitorCog,
  "Hardware troubleshooting": LuWrench,
  "PC assembly": LuCpu,
  "LAN diagnostics": LuNetwork,
  "Active Directory": LuUsers,
  "Application support": LuHeadset,

  // Practices
  "Git / GitHub": SiGithub,
  "Agile / Scrum": LuKanban,
  "AI-assisted development": LuSparkles,
};

/** Group header marks, keyed by `skillGroups[].category`. */
const GROUP_ICONS: Record<string, IconType> = {
  Languages: LuCode,
  Mobile: LuSmartphone,
  "Web and Desktop": LuMonitor,
  Databases: LuDatabase,
  Testing: LuFlaskConical,
  "Cloud and Automation": LuCloud,
  "Systems and Support": LuServer,
  Practices: LuListChecks,
};

/** Timeline node marks, keyed by `experience[].position`. */
const ROLE_ICONS: Record<string, IconType> = {
  Intern: LuGraduationCap,
  "Help Desk Technician": LuHeadset,
  "Freelance Developer": LuLaptop,
};

const DEFAULT_SKILL_ICON = LuCode;
const DEFAULT_GROUP_ICON = LuCode;
const DEFAULT_ROLE_ICON = LuBriefcase;

interface SkillIconProps {
  /** Skill label exactly as it appears in the data file. */
  name: string;
  /** Group the skill belongs to, used when the skill itself has no mark. */
  group?: string;
  className?: string;
}

export function SkillIcon({ name, group, className = "size-3.5" }: SkillIconProps) {
  const Icon = SKILL_ICONS[name] ?? (group ? GROUP_ICONS[group] : undefined) ?? DEFAULT_SKILL_ICON;
  return <Icon className={className} aria-hidden="true" />;
}

interface CategoryIconProps {
  /** Group label exactly as it appears in the data file. */
  category: string;
  className?: string;
}

export function CategoryIcon({ category, className = "size-4" }: CategoryIconProps) {
  const Icon = GROUP_ICONS[category] ?? DEFAULT_GROUP_ICON;
  return <Icon className={className} aria-hidden="true" />;
}

interface RoleIconProps {
  /** Position title exactly as it appears in the data file. */
  position: string;
  className?: string;
}

export function RoleIcon({ position, className = "size-4" }: RoleIconProps) {
  const Icon = ROLE_ICONS[position] ?? DEFAULT_ROLE_ICON;
  return <Icon className={className} aria-hidden="true" />;
}
