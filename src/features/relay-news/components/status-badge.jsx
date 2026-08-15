import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, STATUS_BADGE_CLASSNAMES } from '@/features/relay-news/status-machine';

/** Color-coded status badge used across the list and detail pages. */
export function MessageStatusBadge({ status }) {
  return (
    <Badge
      variant="outline"
      className={STATUS_BADGE_CLASSNAMES[status] ?? ''}
      aria-label={`Status: ${STATUS_LABELS[status] ?? status}`}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
