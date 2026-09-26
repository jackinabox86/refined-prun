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
  offset: number;
  red: number;
  yellow: number;
}

// Count-up keeps the age vs target/offset colours. Countdown shows days left
// until the target and colours that remainder the way burn colours days left.
export function formatRepairCell(input: RepairCellInput): RepairCell {
  if (input.countdown) {
    const remaining = Math.floor(input.target - input.age);
    return {
      text: String(remaining),
      missing: remaining <= input.red,
      warning: remaining <= input.yellow,
      supplied: remaining > input.yellow,
    };
  }

  const shown = Math.floor(input.age);
  return {
    text: String(shown),
    missing: shown >= input.target,
    warning: shown >= input.target - input.offset,
    supplied: shown < input.target - input.offset,
  };
}
