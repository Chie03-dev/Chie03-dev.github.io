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
    systemArchitectureSteps: [
      {
        title: "Local Host Handshake",
        description:
          "The Electron desktop app starts a local WebSocket server and advertises a QR code plus a 4-digit PIN. Android clients resolve the host on the LAN and complete a handshake to receive the exam session token.",
      },
      {
        title: "Telemetry Sync",
        description:
          "Student answers and presence stream to the host over WebSocket in real time. A heartbeat every 5 seconds tracks connectivity, and the host reconciles state so a dropped client can rejoin without data loss.",
      },
      {
        title: "Lock Task Session Recovery",
        description:
          "On the client, Lock Task Mode pins the app for exam integrity. If the process is killed, local Room persistence restores the in-progress session and the device re-handshakes to resume where it left off.",
      },
    ],
    codeSnippet: {
      language: "kotlin",
      filename: "ExamSession.kt",
      code: `// Lock Task Mode pins the app so students cannot exit mid-exam.
fun startLockedExamSession(activity: Activity) {
    val admin = activity.getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
    if (admin.isLockTaskPermitted(activity.packageName)) {
        activity.startLockTask()
    }
}

// Heartbeat keeps the host aware of each connected student client.
fun startHeartbeat(socket: WebSocket, scope: CoroutineScope) = scope.launch {
    while (isActive) {
        val frame = buildHeartbeatFrame(studentId, Clock.System.now())
        socket.send(frame)
        delay(HEARTBEAT_INTERVAL_MS)
    }
}`,
    },
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
    codeSnippet: {
      language: "kotlin",
      filename: "ScanPipeline.kt",
      code: `// CameraX analyzer decodes barcodes on the image stream.
class BarcodeAnalyzer(
    private val scanner: BarcodeScanner,
    private val onScan: (String) -> Unit,
) : ImageAnalysis.Analyzer {
    override fun analyze(image: ImageProxy) {
        val input = InputImage.fromMediaImage(image.image, image.imageInfo.rotationDegrees)
        scanner.process(input)
            .addOnSuccessListener { codes -> codes.firstOrNull()?.rawValue?.let(onScan) }
            .addOnCompleteListener { image.close() }
    }
}

// Persist each scan into Room inside a single transaction.
suspend fun recordScan(dao: SaleDao, sku: String) = dao.withTransaction {
    val item = dao.findBySku(sku) ?: return@withTransaction
    dao.decrementStock(item.id)
    dao.insertSaleLine(SaleLine(sku = sku, qty = 1))
}`,
    },
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
    beforeAfterMetrics: [
      {
        label: "Total Served Assets",
        before: "3.8 MB",
        after: "55 KB",
        reductionPercentage: 98.5,
      },
    ],
    codeSnippet: {
      language: "typescript",
      filename: "worker.ts",
      code: `// Cloudflare Worker edge route: serve static assets, fall back to the app shell.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
    return env.ASSETS.fetch(new Request(new URL(INDEX_PATH, request.url), request));
  },
};`,
    },
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
