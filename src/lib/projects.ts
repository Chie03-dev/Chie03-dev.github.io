import type { ProjectCaseStudy } from "@/types/project";

/**
 * In-memory content engine for engineering case studies.
 *
 * Functions are synchronous because the source data is local; this keeps them
 * callable directly from Server Components without async ceremony. When the
 * content migrates to MDX (Velite), these signatures can become async without
 * changing consumers.
 */

const PROJECTS: ProjectCaseStudy[] = [
  {
    id: "lan-quiz-system",
    slug: "lan-quiz-system",
    title: "LAN Quiz System (Android and Desktop)",
    description:
      "An offline-first classroom examination platform pairing an Electron desktop host with Android student clients over a local WebSocket network, requiring no internet dependency.",
    role: "Lead Systems Engineer",
    timeline: "09/2026 - Present",
    tags: [
      "Kotlin",
      "Jetpack Compose",
      "Electron",
      "TypeScript",
      "Node.js",
      "WebSockets",
      "PostgreSQL",
    ],
    metrics: [
      { label: "WAN Dependency", value: "0ms (Offline)" },
      { label: "Supported Question Types", value: "8 Random" },
      { label: "Exam Integrity", value: "Lock Task Mode" },
    ],
    architectureHighlights: [
      "Designed an offline-first classroom examination platform where an Electron desktop app hosts a local WebSocket server for Android student clients joining via QR code or 4-digit PIN.",
      "Implemented exam integrity protections including Android Lock Task Mode, real-time WebSocket telemetry, heartbeat tracking, local answer persistence, and device session recovery.",
      "Built server-side timer validation and automated question randomization across 8 question types verified against local server testing.",
    ],
    githubUrl: "https://github.com/Chie03-dev",
    featured: true,
  },
  {
    id: "mobile-pos-inventory",
    slug: "mobile-pos-inventory-system",
    title: "Mobile POS and Inventory System",
    description:
      "An Android point-of-sale and inventory tracking application tailored for small retail stores, with barcode scanning, sales analytics, and automated PDF receipts.",
    role: "Android Developer",
    timeline: "01/2025 - 04/2026",
    tags: [
      "Kotlin",
      "Java",
      "Room SQLite",
      "MVVM",
      "CameraX",
      "Google ML Kit",
      "MPAndroidChart",
    ],
    metrics: [
      { label: "Scanner Integration", value: "CameraX + ML Kit" },
      { label: "Persistence", value: "Room SQLite" },
      { label: "Export Support", value: "iText PDF" },
    ],
    architectureHighlights: [
      "Engineered an Android POS and inventory tracking application tailored for small retail stores.",
      "Built automated barcode scanning and transaction checkout workflows using CameraX and Google ML Kit.",
      "Integrated MPAndroidChart for sales analytics, demand forecasting, and inventory restock alerts alongside automated PDF receipt rendering via iText.",
    ],
    githubUrl: "https://github.com/Chie03-dev",
    featured: true,
  },
  {
    id: "barangay-demo-services-portal",
    slug: "barangay-demo-services-portal",
    title: "Barangay Demo Services Portal",
    description:
      "A resident-facing portal for municipal services including document requests, incident logging, request tracking, and official directories, optimized for fast first load.",
    role: "Full-Stack Developer",
    timeline: "07/2023 - Present",
    tags: [
      "Next.js 15",
      "React 19",
      "TypeScript",
      "Tailwind CSS v4",
      "Framer Motion",
      "Cloudflare Workers",
    ],
    metrics: [
      { label: "Asset Size Reduction", value: "-98.5%" },
      { label: "Initial JS Payload", value: "55 KB" },
      { label: "Deployment", value: "Cloudflare OpenNext" },
    ],
    architectureHighlights: [
      "Built a resident-facing portal for municipal services including document requests, incident logging, request tracking, and official directories.",
      "Optimized frontend performance by converting legacy images to WebP and removing custom web fonts, cutting served assets from 3.8 MB to 55 KB.",
      "Designed accessible UI components featuring dark mode, reduced-motion preferences, route protection, and API-ready loading states.",
    ],
    githubUrl: "https://github.com/Chie03-dev",
    featured: true,
  },
];


/** All case studies, in display order. */
export function getCaseStudies(): ProjectCaseStudy[] {
  return PROJECTS;
}

/** Only the case studies flagged as featured (used on the landing page). */
export function getFeaturedProjects(): ProjectCaseStudy[] {
  return PROJECTS.filter((project) => project.featured);
}

/** Look up a single case study by its slug. */
export function getProjectBySlug(slug: string): ProjectCaseStudy | undefined {
  return PROJECTS.find((project) => project.slug === slug);
}
