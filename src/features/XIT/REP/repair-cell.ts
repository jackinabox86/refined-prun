export interface RepairCell {
  text: string;
  missing: boolean;
  warning: boolean;
  supplied: boolean;
}

export interface RepairCellInput {
  age: number;
  countdown: boolean;
  target: number;
  red: number;
  yellow: number;
}

// Both modes colour from the days left until the target, using the repair red
// and yellow thresholds the way burn colours days of supply left. Only the shown
// number differs: count-up shows the age, countdown shows the remainder.
export function formatRepairCell(input: RepairCellInput): RepairCell {
  const remaining = Math.floor(input.target - input.age);
  return {
    text: input.countdown ? String(remaining) : String(Math.floor(input.age)),
    missing: remaining <= input.red,
    warning: remaining <= input.yellow,
    supplied: remaining > input.yellow,
  };
}
