"use client";

import { useState } from "react";
import { ArrowUpRight, Star } from "lucide-react";

import { formatFullDate } from "@/components/glassdoor/format";
import {
  GlassdoorImportButton,
  GlassdoorImportNotice,
} from "@/components/glassdoor/import-control";
import { InterviewsTab } from "@/components/glassdoor/interviews-tab";
import { RatingsTab } from "@/components/glassdoor/ratings-tab";
import { ReviewsTab } from "@/components/glassdoor/reviews-tab";
import { SalariesTab } from "@/components/glassdoor/salaries-tab";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Panel, PanelHeader, PanelMeta, PanelTitle } from "@/components/ui/panel";
import { TabBar, TabBarItem } from "@/components/ui/tab-bar";
import type { GlassdoorView } from "@/lib/glassdoor/view";
import type { GlassdoorFileImportResult } from "@/server/actions/glassdoor";

type TabKey = "ratings" | "reviews" | "interviews" | "salaries";

/**
 * "Glassdoor" panel of the company page: ratings, reviews, interview reports
 * and salary ranges from the latest import, plus the manual JSON upload.
 */
export function GlassdoorSection({
  view,
  glassdoorUrl,
}: {
  view: GlassdoorView | null;
  glassdoorUrl: string | null;
}) {
  const [tab, setTab] = useState<TabKey>("ratings");
  const [result, setResult] = useState<GlassdoorFileImportResult | null>(null);

  const link = glassdoorUrl ?? view?.overviewUrl ?? null;
  const collected = view ? formatFullDate(view.collectedAt) : null;

  return (
    <Panel className="overflow-hidden" aria-label="Glassdoor">
      <PanelHeader className="flex-wrap max-sm:py-2">
        <PanelTitle>Glassdoor</PanelTitle>
        <PanelMeta className="flex-wrap justify-end gap-x-3">
          {collected ? (
            <span>
              Coletado em <span className="font-data text-muted-foreground">{collected}</span>
            </span>
          ) : null}
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="text-link underline-offset-4 hover:text-link-hover hover:underline focus-visible:underline"
            >
              Ver no Glassdoor
              <ArrowUpRight aria-hidden className="ml-0.5 inline size-3.5 align-[-0.125em]" />
            </a>
          ) : null}
          <GlassdoorImportButton onResult={setResult} size="sm" />
        </PanelMeta>
      </PanelHeader>

      {result ? (
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <GlassdoorImportNotice result={result} />
        </div>
      ) : null}

      {!view ? (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Star />
            </EmptyMedia>
            <EmptyTitle>Sem dados do Glassdoor</EmptyTitle>
            <EmptyDescription>
              Rode a skill glassdoor-collect para esta empresa ou importe o JSON gerado por
              ela.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <TabBar aria-label="Seções do Glassdoor">
            <TabBarItem selected={tab === "ratings"} onClick={() => setTab("ratings")}>
              Notas
            </TabBarItem>
            <TabBarItem
              selected={tab === "reviews"}
              count={view.storedReviewCount}
              onClick={() => setTab("reviews")}
            >
              Avaliações
            </TabBarItem>
            <TabBarItem
              selected={tab === "interviews"}
              count={view.interviews.items.length}
              onClick={() => setTab("interviews")}
            >
              Entrevistas
            </TabBarItem>
            <TabBarItem
              selected={tab === "salaries"}
              count={view.salaries.length}
              onClick={() => setTab("salaries")}
            >
              Salários
            </TabBarItem>
          </TabBar>

          <div role="tabpanel">
            {tab === "ratings" ? <RatingsTab view={view} /> : null}
            {tab === "reviews" ? (
              <ReviewsTab reviews={view.reviews} storedCount={view.storedReviewCount} />
            ) : null}
            {tab === "interviews" ? <InterviewsTab interviews={view.interviews} /> : null}
            {tab === "salaries" ? <SalariesTab salaries={view.salaries} /> : null}
          </div>
        </>
      )}
    </Panel>
  );
}
