/** Day-over-day percentage change helper for StatCard trend badges. Returns
 *  null when there's nothing meaningful to compare (both values are 0). */
export function computeTrend(current, previous) {
  if (previous === 0) {
    if (current === 0) return null;
    return { direction: 'up', label: 'Baru' };
  }
  const change = ((current - previous) / previous) * 100;
  const direction = change >= 0 ? 'up' : 'down';
  const rounded = Math.round(Math.abs(change));
  return { direction, label: `${direction === 'up' ? '+' : '-'}${rounded}%` };
}
