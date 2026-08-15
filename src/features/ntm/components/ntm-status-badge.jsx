import { Badge } from '@/components/ui/badge';
import { NTM_STATUS_LABELS, NTM_STATUS_BADGE_CLASSNAMES } from '@/features/ntm/status-machine';

/** Color-coded status badge used across the /ntm list and detail pages. */
export function NtmStatusBadge({ status }) {
  return (
    <Badge
      variant="outline"
      className={NTM_STATUS_BADGE_CLASSNAMES[status] ?? ''}
      aria-label={`Status: ${NTM_STATUS_LABELS[status] ?? status}`}
    >
      {NTM_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
