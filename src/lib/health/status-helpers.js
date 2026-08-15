import { HEALTH_STATUS } from './constants';

/**
 * Resolves the status to display for a component/station that may
 * never have been checked yet — item 7: "Gunakan status UNKNOWN jika
 * perangkat belum pernah dicek." `latestRow` is the latest
 * system_health_checks row for that component/station, or null/undefined
 * if none exists.
 */
export function resolveDisplayStatus(latestRow) {
  return latestRow?.status ?? HEALTH_STATUS.UNKNOWN;
}
