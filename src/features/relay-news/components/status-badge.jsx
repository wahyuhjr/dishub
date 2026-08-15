import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, STATUS_BADGE_CLASSNAMES, PRIORITY_LABELS, PRIORITY_BADGE_CLASSNAMES } from '@/features/relay-news/status-machine';

/** Color-coded status badge with a matching left-border accent. */
export function MessageStatusBadge({ status }) {
  return (
    <Badge
      variant="outline"
      className={STATUS_BADGE_CLASSNAMES[status] ?? 'border-border bg-muted/60 text-muted-foreground'}
      aria-label={`Status: ${STATUS_LABELS[status] ?? status}`}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

/** Color-coded priority badge — LOW (gray) → NORMAL (blue) → HIGH (amber) → CRITICAL (red). */
export function PriorityBadge({ priority }) {
  return (
    <Badge
      variant="outline"
      className={PRIORITY_BADGE_CLASSNAMES[priority] ?? 'border-border bg-muted/60 text-muted-foreground'}
      aria-label={`Prioritas: ${PRIORITY_LABELS[priority] ?? priority}`}
    >
      {PRIORITY_LABELS[priority] ?? priority}
    </Badge>
  );
}
