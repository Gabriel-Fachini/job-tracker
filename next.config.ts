import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.15.187'],
  outputFileTracingIncludes: {
    "/*": [
      "./uploads/**/*",
      "./job-tracker.db",
      "./job-tracker.db-shm",
      "./job-tracker.db-wal",
    ],
  },
  serverExternalPackages: ["better-sqlite3", "pdfjs-dist"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
