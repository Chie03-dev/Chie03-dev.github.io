import Link from "next/link";

import { site } from "@/lib/site";

/** Minimal shape of the GitHub repos API fields we consume. */
interface GithubRepo {
  name: string;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  pushed_at: string;
}

interface GithubActivityData {
  username: string;
  totalStars: number;
  publicRepos: number;
  topLanguages: string[];
  recentRepos: { name: string; url: string; pushedAt: string; stars: number }[];
  source: "live" | "fallback";
}

const FALLBACK: Omit<GithubActivityData, "username"> = {
  totalStars: 412,
  publicRepos: 28,
  topLanguages: ["Kotlin", "TypeScript", "Swift"],
  recentRepos: [
    {
      name: "offline-sync-engine",
      url: "https://github.com/",
      pushedAt: "2024-05-18",
      stars: 186,
    },
    {
      name: "compose-state-flow",
      url: "https://github.com/",
      pushedAt: "2024-04-02",
      stars: 97,
    },
    {
      name: "next-telemetry-dashboard",
      url: "https://github.com/",
      pushedAt: "2024-02-27",
      stars: 129,
    },
  ],
  source: "fallback",
};

function mockData(username: string): GithubActivityData {
  return { username, ...FALLBACK };
}

/**
 * Fetch public repo stats for a GitHub user. Falls back to mock data when the
 * username env var is missing, the network is unavailable, the request is
 * rate-limited, or the response is malformed, so static builds never break.
 */
async function fetchGithubActivity(): Promise<GithubActivityData> {
  const username = process.env.GITHUB_USERNAME;
  if (!username) return mockData(site.githubUsername);

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&sort=pushed`,
      {
        headers,
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) return mockData(username);

    const repos = (await response.json()) as GithubRepo[];
    if (!Array.isArray(repos) || repos.length === 0) return mockData(username);

    const totalStars = repos.reduce(
      (sum, repo) => sum + repo.stargazers_count,
      0,
    );

    const languageCounts = new Map<string, number>();
    for (const repo of repos) {
      if (repo.language) {
        languageCounts.set(
          repo.language,
          (languageCounts.get(repo.language) ?? 0) + 1,
        );
      }
    }
    const topLanguages = [...languageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([language]) => language);

    const recentRepos = [...repos]
      .sort(
        (a, b) =>
          new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime(),
      )
      .slice(0, 3)
      .map((repo) => ({
        name: repo.name,
        url: repo.html_url,
        pushedAt: repo.pushed_at.slice(0, 10),
        stars: repo.stargazers_count,
      }));

    return {
      username,
      totalStars,
      publicRepos: repos.length,
      topLanguages: topLanguages.length ? topLanguages : FALLBACK.topLanguages,
      recentRepos,
      source: "live",
    };
  } catch {
    return mockData(username);
  }
}

function StarIcon() {
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
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.11a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  );
}

function RepoIcon() {
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
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </svg>
  );
}

/**
 * Live GitHub activity feed. A Server Component that fetches public repository
 * stats (star count, primary languages, recent activity) from the GitHub REST
 * API, with a graceful mock fallback so the static build never fails.
 */
export async function GithubActivity() {
  const data = await fetchGithubActivity();
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section id="open-source" className="py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Open Source Activity
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            A snapshot of my public repositories, primary languages, and recent
            work on GitHub.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
          {/* Header row */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-6">
            <Link
              href={`https://github.com/${data.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="h-5 w-5"
              >
                <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.1c-3.2.7-3.88-1.36-3.88-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.04 1.78 2.73 1.27 3.4.97.1-.75.4-1.27.73-1.56-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
              </svg>
              @{data.username}
            </Link>
            <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {data.source === "live" ? "Live data" : "Sample data"}
            </span>
          </div>

          {/* Aggregate metrics */}
          <dl className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/30 p-4">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <StarIcon />
                Total Stars
              </dt>
              <dd className="text-2xl font-bold tracking-tight text-foreground">
                {data.totalStars}
              </dd>
            </div>
            <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/30 p-4">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <RepoIcon />
                Public Repos
              </dt>
              <dd className="text-2xl font-bold tracking-tight text-foreground">
                {data.publicRepos}
              </dd>
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-4">
              <dt className="text-xs font-medium text-muted-foreground">
                Top Languages
              </dt>
              <dd>
                <ul className="flex flex-wrap gap-1.5">
                  {data.topLanguages.map((language) => (
                    <li
                      key={language}
                      className="rounded-md border border-primary/50 bg-primary/10 px-2 py-0.5 text-xs font-medium text-foreground"
                    >
                      {language}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>

          {/* Recent repositories */}
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Repositories
          </h3>
          <ul className="flex flex-col divide-y divide-border/60">
            {data.recentRepos.map((repo) => (
              <li
                key={repo.name}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <Link
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {repo.name}
                </Link>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <time dateTime={repo.pushedAt}>
                    {dateFormatter.format(new Date(repo.pushedAt))}
                  </time>
                  <span className="inline-flex items-center gap-1">
                    <StarIcon />
                    {repo.stars}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}


