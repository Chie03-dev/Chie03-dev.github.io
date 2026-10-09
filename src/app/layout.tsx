import type { Metadata } from "next";

import { CommandPalette } from "@/components/showcases/command-palette";
import { site } from "@/lib/site";

import "./globals.css";

// First name used for the page title so the full legal name never appears in
// the browser tab, link previews, or search results.
const TITLE_NAME = site.name.split(" ")[0];

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${TITLE_NAME} - ${site.role}`,
    template: `%s - ${TITLE_NAME}`,
  },
  description: site.description,
  keywords: [
    "Software Engineer",
    "Mobile Engineer",
    "Full-Stack Engineer",
    "Kotlin",
    "Android",
    "Jetpack Compose",
    "Next.js",
    "TypeScript",
    "Electron",
    "Systems Architecture",
  ],
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: site.url,
    siteName: site.name,
    title: `${TITLE_NAME} - ${site.role}`,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE_NAME} - ${site.role}`,
    description: site.description,
  },
};

// Applied before paint to avoid a flash of the wrong theme. Reads the stored
// preference, falling back to the OS color scheme.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

// JSON-LD Person structured data for rich search engine indexing.
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  jobTitle: site.role,
  url: site.url,
  email: `mailto:${site.email}`,
  sameAs: [site.github, site.linkedin],
  knowsAbout: [
    "Mobile Engineering",
    "Full-Stack Development",
    "Kotlin",
    "Android",
    "Next.js",
    "TypeScript",
    "Systems Architecture",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth scroll-pt-24" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[110] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        {children}
        <CommandPalette />
      </body>
    </html>
  );
}


