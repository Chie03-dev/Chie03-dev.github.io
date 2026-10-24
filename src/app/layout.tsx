import type { Metadata } from "next";

import { CommandPalette } from "@/components/showcases/command-palette";
import { Navbar } from "@/components/layout/navbar";
import { UnlockFlash } from "@/components/ui/unlock-flash";
import { BackToTop } from "@/components/ui/back-to-top";
import { HeroLockProvider } from "@/context/hero-lock-context";
import { ScrollDusk } from "@/components/ui/scroll-dusk";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
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
    "Computer Science",
    "Software Developer",
    "Android",
    "Kotlin",
    "Jetpack Compose",
    "React",
    "Next.js",
    "TypeScript",
    "Electron",
    "POS Systems",
    "Technical Support",
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
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: `${site.name} - ${site.role}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE_NAME} - ${site.role}`,
    description: site.description,
    images: ["/og.png"],
  },
};

// The palette's dark-theme command and the navbar toggle both read the hero's
// containment state, so the lock provider wraps the whole app: the theme is a
// site-wide state, not a per-page one. No theme-init script is needed - there
// is nothing to persist or detect, since the default theme is the only one
// available while the hero is caged (see src/lib/theme.ts).

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
    "Android Development",
    "Kotlin",
    "React",
    "Next.js",
    "TypeScript",
    "Electron",
    "Database Systems",
    "Technical Support",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-pt-24" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
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
        {/* Fixed dusk tint that deepens as the page scrolls. Sits at z-0 behind
            the relative z-10 content layer so it darkens the page background
            without dimming text or opaque cards. */}
        <ScrollDusk />
        <SmoothScroll />
        <HeroLockProvider>
          <div className="relative z-10 page-transition">
            <Navbar />
            {children}
            <UnlockFlash />
            <BackToTop />
          </div>
          <CommandPalette />
        </HeroLockProvider>
      </body>
    </html>
  );
}


