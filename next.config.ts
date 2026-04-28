import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": [
      "./uploads/**/*",
      "./job-tracker.db",
      "./job-tracker.db-shm",
      "./job-tracker.db-wal",
    ],
  },
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
