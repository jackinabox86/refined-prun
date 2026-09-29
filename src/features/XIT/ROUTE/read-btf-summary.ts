export interface BtfLabels {
  duration: string;
  consumption: string;
}

export type BtfSummary =
  | { ok: true; duration: string; seconds: number; stl: number; ftl: number }
  | { ok: false; reason: string };

const defaultLabels: BtfLabels = { duration: 'Duration', consumption: 'Consumption' };

// Summary row of a blueprint test flight. A `--` duration is a missing plan,
// not a zero-length flight, and a missing fuel cell is not zero fuel.
export function readBtfSummary(
  headers: string[],
  cells: string[],
  labels: BtfLabels = defaultLabels,
): BtfSummary {
  const durationIndex = headers.findIndex(x => x.trim().startsWith(labels.duration));
  const consumptionIndex = headers.findIndex(x => x.trim().startsWith(labels.consumption));
  if (durationIndex < 0 || consumptionIndex < 0) {
    return { ok: false, reason: 'flight plan table is missing duration or fuel' };
  }
  const duration = cells[durationIndex]?.trim() ?? '';
  const seconds = parseDurationSeconds(duration);
  if (seconds === undefined) {
    const reason =
      duration === '--' || duration.length === 0
        ? 'no flight plan'
        : `unreadable duration "${duration}"`;
    return { ok: false, reason };
  }
  const fuel = parseFuel(cells[consumptionIndex]?.trim() ?? '');
  if (fuel === undefined) {
    return { ok: false, reason: 'no fuel figures' };
  }
  return { ok: true, duration, seconds, stl: fuel.stl, ftl: fuel.ftl };
}

export function parseDurationSeconds(text: string) {
  const match = /^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/.exec(text.trim());
  if (match === null) {
    return undefined;
  }
  if (match[1] === undefined && match[2] === undefined && match[3] === undefined) {
    return undefined;
  }
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }
  return parts.join(' ');
}

function parseFuel(text: string) {
  const matches = [...text.matchAll(/(\d[\d,]*)\s+units\s+(STL|FTL)\s+fuel/gi)];
  const stl = matches.find(x => x[2]?.toUpperCase() === 'STL');
  if (stl === undefined || stl[1] === undefined) {
    return undefined;
  }
  const ftl = matches.find(x => x[2]?.toUpperCase() === 'FTL');
  return {
    stl: Number(stl[1].replace(/,/g, '')),
    ftl: ftl?.[1] !== undefined ? Number(ftl[1].replace(/,/g, '')) : 0,
  };
}
