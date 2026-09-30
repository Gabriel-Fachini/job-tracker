import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.15.187'],
  // Bottom-left would cover the phone tab bar while developing.
  devIndicators: { position: "top-left" },
  outputFileTracingIncludes: {
    "/*": [
      "./uploads/**/*",
      "./job-tracker.db",
      "./job-tracker.db-shm",
      "./job-tracker.db-wal",
    ],
  },
  // Glassdoor JSON uploads (companies page and company detail) go through a
  // Server Action; full-history files exceed the 1 MB default.
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  serverExternalPackages: ["better-sqlite3", "pdfjs-dist"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
