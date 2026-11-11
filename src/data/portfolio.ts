// Portfolio data, sourced from the resume at public/Resume.pdf.
// Update this file (not the components) to change what's displayed on the site.

export interface PortfolioData {
  name: string;
  bio: string;
  headline: string;
  intro: string;
  projects: Project[];
  experience: Experience[];
  education: Education[];
  skillGroups: SkillGroup[];
  contact: ContactInfo;
}

export const portfolioData: PortfolioData = {
  name: "Alchie O. Andilab",
  bio: "BS Computer Science · Glendale, AZ",
  headline: "SOFTWARE DEVELOPER",
  intro:
    "Computer Science graduate with experience in application development, technical support, hardware/software troubleshooting, and database systems. Proficient in Python, Java, Kotlin, JavaScript, PHP, MySQL, SQLite, RESTful APIs, and Windows/Linux systems. Built a POS inventory management application and administrative systems.",
  projects: [
    {
      id: "1",
      slug: "mobile-pos-inventory",
      title: "Mobile POS and Inventory System",
      description:
        "Android POS and inventory system for small retail stores with barcode checkout via CameraX and Google ML Kit, sales analytics and forecasting with MPAndroidChart, and PDF receipt generation.",
      image: "/projects/mobilepos.webp",
      link: "https://github.com/Chie03-dev/BizPalm-Mobile",
      period: "01/2025 - 04/2026",
      technologies: [
        "Kotlin",
        "Java",
        "Room (SQLite)",
        "MVVM",
        "CameraX",
        "Google ML Kit",
        "MPAndroidChart",
        "iText",
      ],
      detail: {
        problem:
          "Small retail stores need an affordable point-of-sale system, but most POS platforms charge monthly fees and require reliable internet — neither fits a corner store in an area with spotty connectivity.",
        constraints: [
          "Must work offline-first with no internet dependency.",
          "Runs on low-end Android devices.",
          "Barcode checkout must be fast enough for a queue.",
          "Receipts must print as PDF without a cloud service.",
        ],
        decisions: [
          "Room (SQLite) for local-first storage — data lives on the device.",
          "CameraX + Google ML Kit for on-device barcode scanning — no server round-trip.",
          "MPAndroidChart for sales analytics — renders charts entirely on-device.",
          "iText for PDF receipt generation — printable receipts without a network printer.",
          "MVVM architecture — keeps UI and business logic separate as the codebase grew.",
        ],
        tradeoffs: [
          "Local-only storage means no real-time multi-device sync — accepted because most stores run a single register.",
          "Kotlin + Java mix — newer modules in Kotlin, legacy integration in Java.",
        ],
        metrics: [
          "Barcode scans resolve in under 1 second on test hardware.",
          "PDF receipts generate in under 2 seconds including itemised totals.",
          "App installs under 25 MB on entry-level devices.",
        ],
        role: "Sole developer — architecture, UI, database, barcode integration, PDF receipts, and deployment.",
        outcome: "A working offline POS that small stores can install and run without monthly fees or internet.",
        whatIdoDifferently: [
          "Add optional cloud sync for multi-location stores instead of keeping it strictly local.",
          "Add a cashier shift report with open/close balances.",
          "Add product photo support so staff can visually confirm items.",
        ],
        screenshots: ["/projects/mobilepos.webp"],
      },
    },
    {
      id: "2",
      slug: "barangay-demo-portal",
      title: "Barangay Demo Portal",
      description:
        "Resident-facing portal for barangay services — document requests, incident reporting, request tracking, and an officials directory — with route protection, dark mode, and deployment on Cloudflare Workers.",
      image: "/projects/barangay.webp",
      link: "https://github.com/Chie03-dev/Barangay",
      period: "07/2023 - Present",
      technologies: [
        "Next.js 15",
        "React 19",
        "TypeScript",
        "Tailwind CSS v4",
        "Framer Motion",
        "Cloudflare Workers",
      ],
      detail: {
        problem:
          "Residents had to visit the barangay hall in person for document requests, incident reports, and to look up officials — slow for citizens and a bottleneck for staff.",
        constraints: [
          "Deploy on Cloudflare Workers — edge runtime, no long-running server processes.",
          "Route protection — only authenticated users can submit or track requests.",
          "Dark mode required.",
        ],
        decisions: [
          "Next.js 15 App Router — server components by default, edge-compatible.",
          "Cloudflare Workers deployment — matches the edge constraint and keeps hosting near-free.",
          "Framer Motion — page transitions and smooth UI feedback.",
        ],
        tradeoffs: [
          "Edge runtime limits — no long-running background jobs; scheduled tasks need external triggers.",
          "Serverless cold starts — mitigated with lightweight pages and edge caching.",
        ],
        metrics: [
          "Page loads under 800 ms on edge locations tested.",
          "Document request flow completed in under 3 clicks.",
        ],
        role: "Full-stack developer — frontend, route protection, dark mode, Cloudflare Workers deployment.",
        outcome:
          "A resident-facing portal that reduces in-person visits for routine barangay services.",
        whatIdoDifferently: [
          "Add SMS notifications for request status updates.",
          "Add online payment for document fees.",
          "Add a staff dashboard with analytics on request volume.",
        ],
        screenshots: ["/projects/barangay.webp"],
      },
    },
    {
      id: "3",
      slug: "lan-quiz-system",
      title: "LAN Quiz System (Android and Desktop)",
      description:
        "Offline classroom quiz system where an Electron instructor app hosts a local WebSocket server and Android students join via QR code or PIN, with Lock Task Mode integrity, telemetry, and 8 question types.",
      image: "/projects/Quiz.webp",
      link: "https://github.com/Chie03-dev/QuizStudent",
      period: "09/2026 - Present",
      technologies: [
        "Kotlin",
        "Jetpack Compose",
        "Electron",
        "Node.js",
        "TypeScript",
        "WebSockets",
        "PostgreSQL",
      ],
      detail: {
        problem:
          "Teachers need to run classroom quizzes without internet, prevent cheating, and get instant results — paper quizzes are slow to grade and easy to compromise.",
        constraints: [
          "No internet — LAN-only communication between instructor and students.",
          "Integrity — students can't switch apps during the quiz (Lock Task Mode).",
          "8 different question types — multiple choice, true/false, short answer, and more.",
          "Students join via QR code or PIN without installing an app.",
        ],
        decisions: [
          "Electron instructor app + local WebSocket server — instructor hosts, students connect on the LAN.",
          "Android student app via QR code or PIN — zero install for quick classroom entry.",
          "Lock Task Mode — pins the student device to the quiz app during the test.",
          "PostgreSQL — stores quiz results and telemetry for later analysis.",
        ],
        tradeoffs: [
          "Electron bundle size is larger than a native desktop app, but cross-platform shipping was faster.",
          "WebSockets need persistent connections — more complex than HTTP polling but real-time results are worth it.",
        ],
        metrics: [
          "8 question types supported.",
          "Quiz results delivered in real time to the instructor dashboard.",
          "Telemetry tracks attempt duration, answer changes, and flagged events.",
        ],
        role: "Full-stack developer — Electron desktop app, WebSocket server, Android student app, database schema.",
        outcome:
          "An offline classroom quiz system where teachers run live quizzes and students join by QR code or PIN.",
        whatIdoDifferently: [
          "Add a teacher dashboard with per-student analytics and export to CSV.",
          "Add a review mode so students see which answers they missed after the quiz.",
          "Add randomised question ordering per student to further reduce collusion.",
        ],
        screenshots: ["/projects/Quiz.webp"],
      },
    },
    {
      id: "4",
      slug: "school-systems-demo",
      title: "School Systems Demo",
      description:
        "School administration platform demo with dashboards for enrolment, attendance tracking, grade records, and per-program reporting.",
      image: "/projects/schoolsystems.svg",
      link: "https://github.com/Chie03-dev",
      period: "2026",
      technologies: [
        "Next.js",
        "React",
        "TypeScript",
        "Tailwind CSS",
        "PostgreSQL",
      ],
      detail: {
        problem:
          "Schools still manage enrolment, attendance, and grades on paper or spreadsheets — slow to report, hard to audit, and error-prone.",
        constraints: [
          "Multiple user roles — admin, teacher, parent, and student views with different permissions.",
          "Per-program reporting — reports must aggregate by course and year level.",
          "Demo-quality build — needs to look real without connecting to live school data.",
        ],
        decisions: [
          "Next.js + React + TypeScript — type-safe full-stack with server components.",
          "Tailwind CSS — rapid UI development with a consistent design system.",
          "PostgreSQL — relational data fits enrolment, attendance, and grade records well.",
        ],
        tradeoffs: [
          "Demo uses seed/mock data — real integration with a school's SIS would need API adapters.",
          "Role-based access is simplified for the demo — production would need finer-grained permissions.",
        ],
        metrics: [
          "Dashboard loads under 1 second with seed data.",
          "Reports generate on-demand with no page reloads.",
        ],
        role: "Full-stack developer — dashboards, enrolment flow, attendance tracking, grade records, reporting.",
        outcome:
          "A school administration platform demo showing enrolment, attendance, grades, and per-program reporting.",
        whatIdoDifferently: [
          "Add a parent portal with real-time grade and attendance notifications.",
          "Add biometric or RFID attendance instead of manual entry.",
          "Add automated report card generation as PDF.",
        ],
        screenshots: ["/projects/schoolsystems.svg"],
      },
    },
  ],

  experience: [
    {
      id: "1",
      position: "Intern",
      company: "Drainwiz Computer System",
      location: "Dipolog City, Philippines",
      period: "07/2025 - 08/2025",
      description: [
        "Collaborated with senior software engineers on a client web application, fixing bugs and implementing database connections with HTML, CSS, JavaScript, and PHP.",
        "Diagnosed and resolved hardware and software issues across company Windows and Linux machines, including OS installation, printer, and network equipment troubleshooting.",
        "Worked alongside a two-person senior engineering team under close mentorship, gaining hands-on client-facing development experience while handling IT support responsibilities.",
      ],
    },
    {
      id: "2",
      position: "Help Desk Technician",
      company: "Virtual Buddy",
      location: "Minaog, Dipolog City, Philippines",
      period: "03/2022 - 05/2022",
      description: [
        "Provided technical and application support for customers and employees in a fast-paced call center, troubleshooting hardware, software, and system issues.",
        "Guided users step by step through issue resolution, communicating clearly with both technical and non-technical staff.",
        "Logged and tracked reported issues for technician follow-up and escalation, maintaining accurate records for documentation.",
      ],
    },
    {
      id: "3",
      position: "Freelance Developer",
      company: "Web and System Applications",
      location: "Remote",
      period: "01/2023 - Present",
      description: [
        "Rebuilt frontend components for a legacy School System and 2 barangay management systems across Mindanao, replacing outdated code with modern frameworks.",
        "Addressed recurring portal downtime and slow load times, resulting in noticeably faster performance and more stable uptime post-rebuild.",
        "Defined object and function naming conventions for REST API POST and GET endpoints to support frontend-database integration.",
        "Migrated legacy functions and UI from non-framework code into Node.js, React, Next.js, and Django-based systems, preserving existing functionality.",
        "Collaborated with freelancers and system stakeholders to scope requirements and prioritize fixes across the school and barangay systems.",
      ],
    },
  ],
  education: [
    {
      id: "1",
      degree: "Bachelor of Science in Computer Science",
      school: "Andres Bonifacio College",
      location: "College Park, Dipolog City, Philippines",
      period: "08/2022 - 05/2026",
      description: [
        "Relevant Coursework: Software Engineering, Object-Oriented Programming, Data Structures & Algorithms, Database Systems, Computer Networks, Web Engineering, Artificial Intelligence, Information Security.",
      ],
    },
  ],
  skillGroups: [
    {
      category: "Languages",
      items: ["Kotlin", "Java", "TypeScript", "JavaScript", "Python", "PHP", "HTML/CSS", "SQL"],
    },
    {
      category: "Mobile",
      items: ["Jetpack Compose", "Room", "MVVM", "CameraX", "Google ML Kit", "Android Studio", "Gradle"],
    },
    {
      category: "Web and Desktop",
      items: ["React", "Next.js", "Tailwind CSS", "Node.js", "Electron", "Django", "REST APIs", "WebSockets / SSE"],
    },
    {
      category: "Databases",
      items: ["PostgreSQL", "SQLite", "MySQL", "Cloud Firestore"],
    },
    {
      category: "Testing",
      items: ["Vitest", "Jest", "UI automation scripts"],
    },
    {
      category: "Cloud and Automation",
      items: ["Cloudflare Workers", "AWS", "Zapier", "n8n", "Google Workspace", "Microsoft Office"],
    },
    {
      category: "Systems and Support",
      items: ["Windows & Linux", "Hardware troubleshooting", "PC assembly", "LAN diagnostics", "Active Directory", "Application support"],
    },
    {
      category: "Practices",
      items: ["Git / GitHub", "Agile / Scrum", "AI-assisted development"],
    },
  ],
  contact: {
    description:
      "I'm open to software development roles and freelance work across Android, web, and desktop. Based in Glendale, AZ and available remotely.",
    phone: "602-793-5042",
  },
};

export interface ProjectDetail {
  problem: string;
  constraints: string[];
  decisions: string[];
  tradeoffs: string[];
  metrics: string[];
  role: string;
  outcome: string;
  whatIdoDifferently: string[];
  screenshots: string[];
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  link: string;
  period: string;
  technologies: string[];
  detail: ProjectDetail;
}

export interface Experience {
  id: string;
  company: string;
  position: string;
  location: string;
  period: string;
  description: string[];
}

export interface Education {
  id: string;
  degree: string;
  school: string;
  location: string;
  period: string;
  description?: string[];
}

export interface SkillGroup {
  category: string;
  items: string[];
}

export interface ContactInfo {
  description: string;
  phone: string;
}
