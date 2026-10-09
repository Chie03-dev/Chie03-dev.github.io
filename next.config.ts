import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a fully static site (pure HTML/CSS/JS) for GitHub Pages hosting.
  output: "export",
  // Static export cannot use the Next.js image optimization server, so images
  // are served as-is (unoptimized).
  images: {
    unoptimized: true,
  },
  // Predictable, directory-based URLs for reliable static hosting.
  trailingSlash: true,
};

export default nextConfig;

