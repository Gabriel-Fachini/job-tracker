import { Delta } from "@/components/glassdoor/delta";
import { formatFullDate, formatRating, formatShare } from "@/components/glassdoor/format";
import { TrendChart } from "@/components/glassdoor/trend-chart";
import type { BenchmarkKey } from "@/lib/glassdoor/payload";
import type { GlassdoorView } from "@/lib/glassdoor/view";

const SUB_RATINGS: Array<{ key: BenchmarkKey; label: string }> = [
  { key: "culture_values", label: "Cultura e valores" },
  { key: "work_life_balance", label: "Qualidade de vida" },
  { key: "compensation_benefits", label: "Remuneração e benefícios" },
  { key: "career_opportunities", label: "Oportunidades de carreira" },
  { key: "senior_management", label: "Alta gestão" },
  { key: "diversity_inclusion", label: "Diversidade e inclusão" },
];

const SHARES: Array<{ key: BenchmarkKey; label: string }> = [
  { key: "recommend_to_friend", label: "Recomendam a um amigo" },
  { key: "business_outlook", label: "Perspectiva positiva" },
  { key: "ceo_approval", label: "Aprovam o CEO" },
];

export function RatingsTab({ view }: { view: GlassdoorView }) {
  const { ratings, previous, benchmark } = view;
  const previousDate = previous ? formatFullDate(previous.collectedAt) : null;

  return (
    <div className="divide-y divide-border">
      <div className="flex flex-col gap-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="font-data text-4xl leading-none font-semibold text-foreground">
              {formatRating(ratings.overall)}
              <span className="ml-1 text-base font-medium text-subtle-foreground">/ 5</span>
            </p>
            {view.reviewCount !== null ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                <span className="font-data text-foreground">{view.reviewCount}</span> avaliações
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            {previous ? (
              <Delta
                current={ratings.overall}
                reference={previous.ratings.overall}
                label={`vs coleta de ${previousDate}`}
              />
            ) : null}
            <Delta
              current={ratings.overall}
              reference={benchmark?.overall}
              label="vs média do setor"
            />
            {!previous ? (
              <span className="text-xs text-subtle-foreground">
                Comparação com coletas anteriores aparece a partir da segunda coleta.
              </span>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium text-subtle-foreground">
            Subnotas
            {benchmark ? <span className="font-normal"> · traço = média do setor</span> : null}
          </h3>
          <ul className="mt-3 grid gap-x-10 gap-y-3 md:grid-cols-2">
            {SUB_RATINGS.map(({ key, label }) => (
              <li key={key}>
                <RatingBar
                  label={label}
                  value={ratings[key]}
                  benchmark={benchmark?.[key] ?? null}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4 sm:gap-4 sm:p-5">
        {SHARES.map(({ key, label }) => (
          <div key={key} className="min-w-0">
            <p className="font-data text-xl leading-none font-semibold text-foreground sm:text-2xl">
              {formatShare(ratings[key])}
            </p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">{label}</p>
            <Delta
              current={ratings[key]}
              reference={benchmark?.[key]}
              unit="pp"
              label="vs setor"
              className="mt-0.5 block"
            />
          </div>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        <TrendChart trend={view.trend} overall={ratings.overall} />
      </div>

      {view.distribution ? (
        <div className="p-4 sm:p-5">
          <DistributionBars counts={view.distribution} />
        </div>
      ) : null}
    </div>
  );
}

function RatingBar({
  label,
  value,
  benchmark,
}: {
  label: string;
  value: number | null;
  benchmark: number | null;
}) {
  const title = `${label}: ${formatRating(value)}${benchmark !== null ? ` · setor ${formatRating(benchmark)}` : ""}`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5">
      <span className="min-w-0 truncate text-[13px] text-muted-foreground">{label}</span>
      <span className="font-data text-[13px] text-foreground">{formatRating(value)}</span>
      <span
        role="img"
        aria-label={title}
        title={title}
        className="relative col-span-2 h-1.5 rounded-full bg-muted"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-chart-3"
          style={{ width: `${((value ?? 0) / 5) * 100}%` }}
        />
        {benchmark !== null ? (
          <span
            aria-hidden
            className="absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
            style={{ left: `${(benchmark / 5) * 100}%` }}
          />
        ) : null}
      </span>
    </div>
  );
}

function DistributionBars({ counts }: { counts: number[] }) {
  const total = counts.reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-subtle-foreground">Distribuição da nota geral</h3>
      <ul className="mt-3 flex max-w-md flex-col gap-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = counts[star - 1] ?? 0;

          return (
            <li
              key={star}
              className="grid grid-cols-[2rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-xs"
            >
              <span className="font-data text-muted-foreground">{star} ★</span>
              <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-chart-4"
                  style={{ width: `${(count / total) * 100}%` }}
                />
              </span>
              <span className="text-right font-data text-subtle-foreground">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
