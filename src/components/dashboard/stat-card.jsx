import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ICON_VARIANT_CLASSNAMES = {
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
};

/**
 * Small sparkline rendered as an inline SVG polyline (no charting lib
 * needed for something this small). `points` is an array of numbers;
 * rendered flat/empty if fewer than 2 points are given.
 */
function Sparkline({ points, variant }) {
  if (!points || points.length < 2) return null;

  const width = 100;
  const height = 28;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;

  const coords = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const strokeClass =
    variant === 'success' ? 'stroke-success' : variant === 'danger' ? 'stroke-danger' : variant === 'warning' ? 'stroke-warning' : 'stroke-primary';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={coords} fill="none" className={strokeClass} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Dashboard stat card: solid-colored rounded icon top-left, small gray
 * label, large bold number, small up/down trend indicator top-right,
 * optional sparkline underneath the number.
 *
 * `trend` is optional: { direction: 'up' | 'down', label: '+12%' }.
 * `sparkline` is an optional array of numbers (oldest -> newest).
 */
export function StatCard({ icon: Icon, iconVariant = 'primary', label, value, trend, sparkline, className }) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full',
            ICON_VARIANT_CLASSNAMES[iconVariant] ?? ICON_VARIANT_CLASSNAMES.primary
          )}
          aria-hidden="true"
        >
          {Icon ? <Icon className="size-4.5" /> : null}
        </span>

        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              trend.direction === 'up' ? 'text-success' : 'text-danger'
            )}
          >
            {trend.direction === 'up' ? (
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="size-3.5" aria-hidden="true" />
            )}
            {trend.label}
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">{value}</p>

      {sparkline ? <div className="mt-3">{<Sparkline points={sparkline} variant={iconVariant} />}</div> : null}
    </Card>
  );
}
