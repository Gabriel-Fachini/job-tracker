import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { KitClient, type KitClientData } from "@/components/applications/kit-client";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { readKit } from "@/lib/apply/kit-store";
import { db } from "@/lib/db";
import { applications, companies, jobs } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ApplicationKitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const applicationId = Number(id);

  if (!Number.isInteger(applicationId)) {
    notFound();
  }

  const row = db
    .select({
      status: applications.status,
      appliedAt: applications.appliedAt,
      jobTitle: jobs.title,
      companyName: companies.name,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(applications.id, applicationId))
    .get();

  if (!row) {
    notFound();
  }

  const kit = readKit(applicationId);
  const data: KitClientData = {
    applicationId,
    jobTitle: row.jobTitle,
    companyName: row.companyName,
    applicationStatus: row.status,
    kit: kit
      ? {
          applyUrl: kit.applyUrl,
          status: kit.status,
          hasResume: Boolean(kit.resumePath),
          coverLetter: kit.coverLetter,
          fields: kit.fields,
          answers: kit.answers,
          updatedAt: kit.updatedAt.toISOString(),
        }
      : null,
  };

  return (
    <div className="flex flex-1 flex-col gap-5 sm:gap-6">
      <PageHeader
        leading={
          <Link
            href={`/applications?applicationId=${applicationId}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
          >
            <ChevronLeft data-icon="inline-start" />
            Candidatura
          </Link>
        }
        title="Kit de candidatura"
        description={
          <>
            <span className="text-foreground">{row.companyName}</span>
            <span aria-hidden className="mx-1.5 text-subtle-foreground">·</span>
            {row.jobTitle}
          </>
        }
        actionsPlacement="stacked"
      />

      <KitClient data={data} />
    </div>
  );
}
