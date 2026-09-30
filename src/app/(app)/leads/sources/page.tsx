import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { SourcesClient, type SourceListItem } from "@/components/leads/sources-client";
import { PageHeader } from "@/components/page-header";
import { defaultSources } from "@/lib/job-monitoring/sources/catalog";
import { listSources } from "@/lib/job-monitoring/sources/store";

export const dynamic = "force-dynamic";

export default function SourcesPage() {
  const homepages = new Map<string, string>(defaultSources.map((source) => [source.kind, source.homepage]));
  const items: SourceListItem[] = listSources().map((source) => ({
    id: source.id,
    name: source.name,
    homepage: homepages.get(source.kind) ?? null,
    enabled: source.enabled,
    lastRunAt: source.lastRunAt,
    lastError: source.lastError,
  }));

  return (
    <div className="flex flex-1 flex-col gap-5 sm:gap-6">
      <PageHeader
        leading={
          <Link
            href="/leads"
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft aria-hidden className="size-3.5" />
            Leads
          </Link>
        }
        title="Fontes"
        description={
          <>
            Feeds de vagas remotas: uma fonte traz vagas de várias empresas. Rodam junto com o radar.
          </>
        }
      />

      <SourcesClient items={items} />
    </div>
  );
}
