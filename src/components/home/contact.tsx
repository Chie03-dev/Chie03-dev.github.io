import type { ReactNode } from "react";

import { KeyBand } from "@/components/home/key-band";
import { ContactForm } from "@/components/home/contact-form";
import { SectionRail } from "@/components/ui/section-rail";
import { portfolioData } from "@/data/portfolio";
import { site } from "@/lib/site";
import { LuMail } from "react-icons/lu";

function MailIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.37V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.1c-3.2.7-3.88-1.36-3.88-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.04 1.78 2.73 1.27 3.4.97.1-.75.4-1.27.73-1.56-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "h-4 w-4"}
    >
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

interface ContactLink {
  label: string;
  display: string;
  href: string;
  icon: ReactNode;
  external: boolean;
}

function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//, "");
}

/**
 * Contact section. A Server Component: pure links, no form and no client JS.
 * Email, GitHub, and LinkedIn come from the central site config; phone lives
 * in the portfolio data.
 */
export default function Contact() {
  const { contact } = portfolioData;

  const links: ContactLink[] = [
    {
      label: "Email",
      display: site.email,
      href: `mailto:${site.email}`,
      icon: <MailIcon />,
      external: false,
    },
    {
      label: "Phone",
      display: contact.phone,
      href: `tel:${contact.phone.replace(/[^0-9+]/g, "")}`,
      icon: <PhoneIcon />,
      external: false,
    },
    {
      label: "LinkedIn",
      display: stripProtocol(site.linkedin),
      href: site.linkedin,
      icon: <LinkedInIcon />,
      external: true,
    },
    {
      label: "GitHub",
      display: stripProtocol(site.github),
      href: site.github,
      icon: <GitHubIcon />,
      external: true,
    },
  ];

  return (
    <section id="contact">
      <SectionRail rail={false} icon={<LuMail className="size-4" />}>
        <h2 className="mb-6 text-3xl font-bold tracking-tight uppercase">
          CONTACT ME
        </h2>

        <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
          {contact.description}
        </p>
        <ContactForm />
        <div className="grid gap-4 sm:grid-cols-2">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="group flex min-w-0 items-center gap-4 rounded-xl border border-border/20 p-4 transition-all hover:-translate-y-1 hover:border-primary/20"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/40 text-primary transition-colors group-hover:bg-primary/10">
                {link.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-muted-foreground">
                  {link.label}
                </span>
                <span className="block truncate text-sm font-medium">
                  {link.display}
                </span>
              </span>
              <ArrowIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          ))}
        </div>
        {/* The Vault Key: the guardian clutches the key that breaks the hero's
            containment. Client-side game that clears itself once unbound. */}
        <KeyBand />
      </SectionRail>
    </section>
  );
}
