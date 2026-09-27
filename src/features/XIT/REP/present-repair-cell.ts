import { getRepairThreshold } from '@src/core/buildings';
import { formatRepairCell, RepairCell } from '@src/features/XIT/REP/repair-cell';
import { userData } from '@src/store/user-data';

export function presentRepairCell(age: number, naturalId: string) {
  return formatRepairCell({
    age,
    countdown: userData.settings.repair.countdown === true,
    target: getRepairThreshold(naturalId),
    red: userData.settings.repair.red ?? 3,
    yellow: userData.settings.repair.yellow ?? 7,
  });
}

export function repairCellClass(cell: RepairCell | undefined) {
  if (cell === undefined) {
    return {};
  }
  return {
    [C.Workforces.daysMissing]: cell.missing,
    [C.Workforces.daysWarning]: cell.warning,
    [C.Workforces.daysSupplied]: cell.supplied,
  };
}
