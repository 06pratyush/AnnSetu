import type { NextConfig } from "next";

// GitHub Pages serves a project site from /<repo>/, so the build takes that prefix from
// NEXT_PUBLIC_BASE_PATH (set by the deploy workflow). Locally it is empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
