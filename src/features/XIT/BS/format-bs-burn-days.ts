import { formatBurnDays } from '@src/features/XIT/BURN/utils';

export function formatBsBurnDays(days: number, decimal: boolean) {
  if (decimal) {
    return formatBurnDays(days);
  }
  // Off matches XIT BS before the decimal option: a whole number, infinity from 500 days.
  const d = Math.floor(days);
  return d < 500 ? String(d) : '∞';
}
