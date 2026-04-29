import "server-only";

import { desc } from "drizzle-orm";

import { db } from "@/lib/db";

export async function getProfileSnapshot() {
  return db.query.profile.findFirst({
    orderBy: (table) => [desc(table.updatedAt)],
    with: {
      experiences: {
        orderBy: (table) => [desc(table.startDate)],
      },
      skills: true,
      projects: true,
      education: true,
    },
  });
}
