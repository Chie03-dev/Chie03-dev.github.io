import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.name} - ${site.role}`,
    short_name: site.name,
    description: site.description,
    start_url: "/",
    display: "standalone",
    // Matches the default theme's --background (oklch(0.14 0.06 235)): the site
    // always opens in the navy, since the pitch-black theme is unlock-gated.
    background_color: "#000b1e",
    theme_color: "#000b1e",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
