/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a fully static site (pure HTML/CSS/JS) into out/, which is what the
  // Pages workflow uploads. Without this the build needs a Node server and
  // Pages has nothing to serve.
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
