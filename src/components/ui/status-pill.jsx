import { cn } from '@/lib/utils';

const VARIANT_CLASSNAMES = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  neutral: 'bg-surface-hover text-muted-foreground',
  primary: 'bg-primary/15 text-primary',
};

/**
 * Generic pill/badge for status indicators across the dark minimalist
 * design system (system health, connection status, etc). For
 * domain-specific message status, see
 * src/features/relay-news/components/status-badge.jsx, which reuses the
 * same "/15" translucent-background convention.
 */
export function StatusPill({ variant = 'neutral', className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        VARIANT_CLASSNAMES[variant] ?? VARIANT_CLASSNAMES.neutral,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
