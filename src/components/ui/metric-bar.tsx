import type { BeforeAfterMetric } from "@/types/project";

interface MetricBarProps {
  metric: BeforeAfterMetric;
}

/**
 * Visual before/after telemetry meter. The bar widths are set inline; the
 * `metric-fill` keyframe animates width from 0 to that inline value on mount,
 * so the comparison draws itself without any client JS or transition timing.
 */
export function MetricBar({ metric }: MetricBarProps) {
  // Show what remains after the reduction (clamped so the "after" bar stays visible).
  const remaining = Math.max(100 - metric.reductionPercentage, 2);

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {metric.label}
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          -{metric.reductionPercentage}%
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="w-12 shrink-0 text-xs text-muted-foreground">
            Before
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/60">
            <div
              className="animate-metric-fill h-full rounded-full bg-red-500/70"
              style={{ width: "100%" }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-semibold text-foreground">
            {metric.before}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-12 shrink-0 text-xs text-muted-foreground">
            After
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/60">
            <div
              className="animate-metric-fill h-full rounded-full bg-primary"
              style={{ width: `${remaining}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-semibold text-foreground">
            {metric.after}
          </span>
        </div>
      </div>
    </div>
  );
}