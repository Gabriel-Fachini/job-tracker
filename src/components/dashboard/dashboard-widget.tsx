interface DashboardWidgetProps {
  title: string;
  minSamples?: number;
  actual: number;
  children: React.ReactNode;
  className?: string;
}

export function DashboardWidget({
  title,
  minSamples = 1,
  actual,
  children,
  className = "",
}: DashboardWidgetProps) {
  return (
    <div
      className={`rounded-2xl border border-border/50 bg-card/40 p-5 ${className}`}
    >
      <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
      {actual < minSamples ? (
        <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
          <p className="text-sm text-muted-foreground">Dados insuficientes</p>
          <p className="text-xs text-muted-foreground/50">
            N={actual}, mínimo {minSamples}
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
