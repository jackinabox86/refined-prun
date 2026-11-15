import { userData } from '@src/store/user-data';

// Font Awesome solid rocket (U+F135). Same glyph upstream uses in XIT BURN for
// inbound cargo.
export const EN_ROUTE_ROCKET = '\uf135';

// Blue used for the inv-item rocket marker and the en-route burn cell.
export const EN_ROUTE_BLUE = '#088DBF';
export const EN_ROUTE_BLUE_BG = 'rgba(8, 141, 191, 0.35)';

// A base stop on a looping (automated) shipping route. On-demand routes
// (loop === false) do not count. CX and other non-base stops are ignored.
export function isOnAutomatedRoute(naturalId: string) {
  for (const route of userData.routes) {
    if (route.loop === false) {
      continue;
    }
    for (const stop of route.stops) {
      if (stop.kind === 'base' && stop.id === naturalId) {
        return true;
      }
    }
  }
  return false;
}

// Same floor as daysUntilRepairTarget === 0: age has reached the target.
export function hasRepairsDue(age: number | undefined, repairTarget: number) {
  return age !== undefined && age >= repairTarget;
}

// Push en-route bases to the bottom of a burn-oriented list. When
// `repairsDueBreaksThrough` is true (BS DYNAMIC), a base with repairs due
// keeps its normal rank instead.
export function compareEnRouteLast(
  aOnRoute: boolean,
  bOnRoute: boolean,
  options?: {
    repairsDueBreaksThrough?: boolean;
    aRepairsDue?: boolean;
    bRepairsDue?: boolean;
  },
) {
  const allow = options?.repairsDueBreaksThrough === true;
  const aLast = aOnRoute && !(allow && options?.aRepairsDue === true);
  const bLast = bOnRoute && !(allow && options?.bRepairsDue === true);
  if (aLast === bLast) {
    return 0;
  }
  return aLast ? 1 : -1;
}
