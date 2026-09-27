import { scoreClasses } from "@/components/leads/lead-decisions";
import { cn } from "@/lib/utils";

/** Classifier score as a data-face number over a hairline meter. */
export function ScoreMeter({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const { text, fill } = scoreClasses(score);
  const width = Math.max(4, Math.min(100, score));

  return (
    <span className={cn("inline-flex w-7 flex-col gap-1.5", className)}>
      <span className={cn("font-data text-[15px] leading-none font-medium", text)}>
        <span className="sr-only">Score </span>
        {score}
      </span>
      <span aria-hidden className="h-0.5 w-full overflow-hidden rounded-full bg-border">
        <span
          className={cn("block h-full rounded-full", fill)}
          style={{ width: `${width}%` }}
        />
      </span>
    </span>
  );
}
