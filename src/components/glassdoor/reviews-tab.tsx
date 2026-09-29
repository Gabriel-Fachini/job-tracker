"use client";

import { useState } from "react";

import { formatMonthYear } from "@/components/glassdoor/format";
import { Button } from "@/components/ui/button";
import { MetaLine } from "@/components/ui/meta-line";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { isTechTitle } from "@/lib/glassdoor/constants";
import type { GlassdoorReviewItem } from "@/lib/glassdoor/view";

const PAGE_SIZE = 8;

export function ReviewsTab({
  reviews,
  storedCount,
}: {
  reviews: GlassdoorReviewItem[];
  storedCount: number;
}) {
  const [techOnly, setTechOnly] = useState(true);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const list = techOnly ? reviews.filter((review) => isTechTitle(review.jobTitle)) : reviews;
  const shown = list.slice(0, visible);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
        <SegmentedControl aria-label="Filtro de avaliações">
          <SegmentedControlItem
            pressed={techOnly}
            onClick={() => {
              setTechOnly((value) => !value);
              setVisible(PAGE_SIZE);
            }}
          >
            Só cargos de tecnologia
          </SegmentedControlItem>
        </SegmentedControl>
        <p className="text-xs text-subtle-foreground">
          <span className="font-data">{list.length}</span> de{" "}
          <span className="font-data">{reviews.length}</span>
          {storedCount > reviews.length ? (
            <>
              {" "}
              (<span className="font-data">{storedCount}</span> importadas) 
            </>
          ) : null}
          {" "}· mais recentes primeiro
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-subtle-foreground sm:px-5">
          Nenhuma avaliação{techOnly ? " de cargos de tecnologia" : ""} importada.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((review) => (
            <li key={review.id} className="flex flex-col gap-2 px-4 py-4 sm:px-5">
              <ReviewRow review={review} />
            </li>
          ))}
        </ul>
      )}

      {list.length > visible ? (
        <div className="flex justify-center border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVisible((value) => value + PAGE_SIZE)}
          >
            Mostrar mais <span className="font-data">{Math.min(PAGE_SIZE, list.length - visible)}</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ReviewRow({ review }: { review: GlassdoorReviewItem }) {
  const tenure =
    review.isCurrent === null
      ? null
      : `${review.isCurrent ? "Funcionário atual" : "Ex-funcionário"}${
          review.yearsEmployed ? ` · ${review.yearsEmployed}+ anos` : ""
        }`;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-sm leading-snug font-medium break-words text-foreground">
          {review.summary ?? "Sem título"}
        </h3>
        {review.rating !== null ? <Stars rating={review.rating} /> : null}
      </div>
      <MetaLine
        className="whitespace-normal"
        items={[
          review.jobTitle ?? "Cargo não informado",
          tenure,
          review.location,
          <span key="date" className="font-data">
            {formatMonthYear(review.date)}
          </span>,
        ]}
      />
      {review.pros || review.cons ? (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-6">
          {review.pros ? <ReviewText label="Prós" text={review.pros} /> : null}
          {review.cons ? <ReviewText label="Contras" text={review.cons} /> : null}
        </div>
      ) : null}
      {review.advice ? <ReviewText label="Conselho à diretoria" text={review.advice} /> : null}
    </>
  );
}

function ReviewText({ label, text }: { label: string; text: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-subtle-foreground">{label}</p>
      <p className="mt-0.5 max-w-[68ch] text-[13px] leading-5 text-pretty break-words whitespace-pre-line text-muted-foreground">
        {text}
      </p>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <span
      role="img"
      aria-label={`${rating} de 5`}
      className="shrink-0 font-data text-[13px] tracking-wider whitespace-nowrap text-foreground"
    >
      {"★".repeat(filled)}
      <span className="text-border-strong">{"★".repeat(5 - filled)}</span>
    </span>
  );
}
