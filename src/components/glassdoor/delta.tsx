import { cn } from "@/lib/utils";

import { formatOneDecimal } from "./format";

/**
 * Signed difference with a triangle and words for screen readers. `unit` "pp"
 * expects fractions (0.05 = 5 pp). Differences too small to matter render as
 * "igual".
 */
export function Delta({
  current,
  reference,
  label,
  unit = "nota",
  className,
}: {
  current: number | null | undefined;
  reference: number | null | undefined;
  label: string;
  unit?: "nota" | "pp";
  className?: string;
}) {
  if (
    current === null ||
    current === undefined ||
    reference === null ||
    reference === undefined
  ) {
    return null;
  }

  const raw = unit === "pp" ? (current - reference) * 100 : current - reference;
  const shown = unit === "pp" ? Math.round(raw) : Math.round(raw * 10) / 10;
  const text = unit === "pp" ? `${Math.abs(shown)} pp` : formatOneDecimal(Math.abs(shown));

  if (shown === 0) {
    return (
      <span className={cn("text-xs text-subtle-foreground", className)}>
        <span className="font-data">igual</span> {label}
      </span>
    );
  }

  const up = shown > 0;

  return (
    <span className={cn("text-xs text-subtle-foreground", className)}>
      <span className={cn("font-data font-medium", up ? "text-positive" : "text-negative")}>
        <span aria-hidden>{up ? "▲" : "▼"} </span>
        <span className="sr-only">{up ? "acima" : "abaixo"}: </span>
        {text}
      </span>{" "}
      {label}
    </span>
  );
}
