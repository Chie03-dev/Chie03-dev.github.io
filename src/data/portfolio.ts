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
    },
    {
      id: "2",
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
    },
    {
      id: "3",
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
    },
    {
      id: "4",
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

export interface Project {
  id: string;
  title: string;
  description: string;
  image: string;
  link: string;
  period: string;
  technologies: string[];
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
