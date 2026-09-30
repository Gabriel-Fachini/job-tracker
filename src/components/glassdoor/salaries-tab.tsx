"use client";

import { useMemo, useState } from "react";

import { formatMoney, formatMonthYear } from "@/components/glassdoor/format";
import { Button } from "@/components/ui/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { isTechTitle } from "@/lib/glassdoor/constants";
import type { GlassdoorSalaryItem, SalaryBand } from "@/lib/glassdoor/view";

const PAGE_SIZE = 12;

type Kind = "base" | "total";

export function SalariesTab({ salaries }: { salaries: GlassdoorSalaryItem[] }) {
  const [kind, setKind] = useState<Kind>("base");
  const [techOnly, setTechOnly] = useState(true);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const rows = useMemo(
    () =>
      salaries
        .filter((item) => !techOnly || isTechTitle(item.jobTitle))
        .filter((item) => hasRange(item[kind]))
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0)),
    [salaries, kind, techOnly],
  );
  const shown = rows.slice(0, visible);
  // One scale for every visible row, so the bars compare with each other.
  const max = Math.max(1, ...shown.map((item) => item[kind].p90 ?? 0));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl aria-label="Tipo de remuneração">
            <SegmentedControlItem pressed={kind === "base"} onClick={() => setKind("base")}>
              Base
            </SegmentedControlItem>
            <SegmentedControlItem pressed={kind === "total"} onClick={() => setKind("total")}>
              Total
            </SegmentedControlItem>
          </SegmentedControl>
          <SegmentedControl aria-label="Filtro de cargos">
            <SegmentedControlItem
              pressed={techOnly}
              onClick={() => {
                setTechOnly((value) => !value);
                setVisible(PAGE_SIZE);
              }}
            >
              Só tecnologia
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
        <p className="text-xs text-subtle-foreground">
          <span className="font-data">{rows.length}</span> cargos · mensal, em R$
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-subtle-foreground sm:px-5">
          Nenhum cargo{techOnly ? " de tecnologia" : ""} com faixa salarial.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((item) => (
            <li key={item.jobTitle} className="px-4 py-3 sm:px-5">
              <SalaryRow item={item} band={item[kind]} max={max} />
            </li>
          ))}
        </ul>
      )}

      {rows.length > visible ? (
        <div className="flex justify-center border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVisible((value) => value + PAGE_SIZE)}
          >
            Mostrar mais <span className="font-data">{Math.min(PAGE_SIZE, rows.length - visible)}</span>
          </Button>
        </div>
      ) : null}

      <p className="border-t border-border px-4 py-3 text-xs text-subtle-foreground sm:px-5">
        Linha = p10 a p90 · caixa = p25 a p75 · traço = mediana.
      </p>
    </div>
  );
}

function hasRange(band: SalaryBand) {
  return band.p10 !== null && band.p50 !== null && band.p90 !== null;
}

function SalaryRow({
  item,
  band,
  max,
}: {
  item: GlassdoorSalaryItem;
  band: SalaryBand;
  max: number;
}) {
  const at = (value: number | null) => `${((value ?? 0) / max) * 100}%`;
  const width = (from: number | null, to: number | null) =>
    `${Math.max(((to ?? 0) - (from ?? 0)) / max, 0) * 100}%`;
  const description = `p10 ${formatMoney(band.p10)} · p25 ${formatMoney(band.p25)} · p50 ${formatMoney(band.p50)} · p75 ${formatMoney(band.p75)} · p90 ${formatMoney(band.p90)}`;
  const updated = formatMonthYear(item.mostRecent);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_6rem]">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-foreground" title={item.jobTitle}>
          {item.jobTitle}
        </p>
        <p className="text-xs text-subtle-foreground">
          {item.count !== null ? (
            <>
              <span className="font-data">{item.count}</span> salários
            </>
          ) : null}
          {updated ? (
            <>
              {item.count !== null ? " · " : ""}atualizado <span className="font-data">{updated}</span>
            </>
          ) : null}
        </p>
      </div>

      <p className="text-right font-data text-[13px] text-foreground md:order-3">
        {formatMoney(band.p50)}
      </p>

      <div
        role="img"
        aria-label={`${item.jobTitle}: ${description}`}
        title={description}
        className="relative col-span-2 h-5 md:order-2 md:col-span-1"
      >
        <span
          aria-hidden
          className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-chart-4"
          style={{ left: at(band.p10), width: width(band.p10, band.p90) }}
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-2.5 min-w-px -translate-y-1/2 rounded-xs bg-chart-3"
          style={{ left: at(band.p25), width: width(band.p25, band.p75) }}
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: at(band.p50) }}
        />
      </div>
    </div>
  );
}
