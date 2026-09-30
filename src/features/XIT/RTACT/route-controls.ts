const DELETE_LABEL = /delete/i;

export function controlLabelOf(el: Element): string {
  const aria = el.getAttribute('aria-label')?.trim() ?? '';
  if (aria.length > 0) {
    return aria;
  }
  const title = el.getAttribute('title')?.trim() ?? '';
  if (title.length > 0 && title.length <= 40) {
    return title;
  }
  let direct = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      direct += node.textContent ?? '';
    }
  }
  direct = direct.replace(/\s+/g, ' ').trim();
  if (direct.length > 0) {
    return direct;
  }
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= 40) {
    return text;
  }
  return '';
}

const EDITOR_CLICKS = new Set([
  'units',
  'capacity',
  'all carried',
  'stl tank',
  'ftl tank',
  'ship store',
  'local store',
]);

export interface NamedControl {
  label: string;
  disabled?: boolean;
  neutral?: boolean;
  danger?: boolean;
}

// Picks a control label. Delete labels and danger controls are refused.
// requireArmed rejects disabled and neutral controls (the grey ADD WAYPOINT).
export function selectControlLabel(
  controls: NamedControl[],
  label: string,
  opts?: { requireArmed?: boolean },
): string {
  if (DELETE_LABEL.test(label)) {
    throw new Error(`Refusing to activate a delete control (${label})`);
  }
  const wanted = label.trim().toLowerCase();
  const match = controls.find(control => control.label.trim().toLowerCase() === wanted);
  if (match === undefined) {
    throw new Error(`Control not found: ${label}`);
  }
  if (DELETE_LABEL.test(match.label) || match.danger === true) {
    throw new Error(`Refusing to activate a delete control (${match.label})`);
  }
  if (opts?.requireArmed === true && (match.disabled === true || match.neutral === true)) {
    throw new Error(`Control is not armed: ${label}`);
  }
  return match.label;
}

export function shouldClickAddWaypoint(input: {
  suggestionPicked: boolean;
  armed: boolean;
}): boolean {
  return input.suggestionPicked && input.armed;
}

export function isAddWaypointArmed(flags: {
  disabled: boolean;
  neutral: boolean;
  danger: boolean;
}): boolean {
  return !flags.disabled && !flags.neutral && !flags.danger;
}

// Editor fills may click mode words only. SAVE, CANCEL, and delete stay with the player.
export function assertEditorClick(label: string): void {
  if (DELETE_LABEL.test(label) || !EDITOR_CLICKS.has(label.trim().toLowerCase())) {
    throw new Error(`Refusing editor click: ${label}`);
  }
}

// Header edit-count is index 0. The waypoint block is the first ancestor whose
// step-pencil count is higher. A later ancestor (the whole list) is not used.
export function blockIndex(editCounts: number[]): number {
  const header = editCounts[0] ?? 0;
  for (let i = 1; i < editCounts.length; i++) {
    if (editCounts[i] > header) {
      return i;
    }
  }
  return 0;
}

export function waypointNeedles(query: string, canonical: string, stationName?: string): string[] {
  const seen = new Set<string>();
  const needles: string[] = [];
  for (const part of [canonical, query, stationName]) {
    const value = part?.trim() ?? '';
    if (value.length === 0) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    needles.push(value);
  }
  return needles;
}

export function isStepEditLabel(label: string): boolean {
  const value = label.trim().toLowerCase();
  if (value.length === 0 || value.includes('delete') || value.includes('waypoint')) {
    return false;
  }
  return value === 'edit' || value === 'edit step';
}

// Word-boundary match, then a substring match. No match returns undefined
// rather than the first suggestion on the page.
export function pickSuggestion(labels: string[], query: string): string | undefined {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundary = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
  const boundaryHit = labels.find(label => boundary.test(label));
  if (boundaryHit !== undefined) {
    return boundaryHit;
  }
  const needle = trimmed.toLowerCase();
  return labels.find(label => label.toLowerCase().includes(needle));
}

// One limit side is two sibling rows. The mode row text is "Minimumunitscapacity"
// with no separators, so a word-boundary test never matches it and a walk up
// lands on the form, where both amounts share one input list.
export interface LimitNode {
  text: string;
  inputs: number;
  parent: number | undefined;
}

function limitText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function modeRowIndex(nodes: LimitNode[], heading: string): number | undefined {
  const wanted = heading.trim().toLowerCase();
  let label = -1;
  let labelLen = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (limitText(nodes[i].text) !== wanted) {
      continue;
    }
    const len = nodes[i].text.length;
    if (len < labelLen) {
      label = i;
      labelLen = len;
    }
  }
  if (label < 0) {
    return undefined;
  }
  let parent = nodes[label].parent;
  while (parent !== undefined && limitText(nodes[parent].text) === wanted) {
    parent = nodes[parent].parent;
  }
  return parent;
}

export function amountRowIndex(nodes: LimitNode[], heading: string): number | undefined {
  const wanted = `${heading.trim().toLowerCase()} units`;
  let best = -1;
  let bestLen = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].inputs < 1) {
      continue;
    }
    const text = limitText(nodes[i].text);
    if (text !== wanted && !text.startsWith(`${wanted} `)) {
      continue;
    }
    const len = nodes[i].text.length;
    if (len <= bestLen) {
      best = i;
      bestLen = len;
    }
  }
  return best < 0 ? undefined : best;
}

export function limitClick(
  currentHasNumber: boolean,
  desired: 'units' | 'capacity' | 'all',
): string | undefined {
  const wantNumber = desired === 'units';
  if (wantNumber === currentHasNumber) {
    return undefined;
  }
  if (desired === 'units') {
    return 'units';
  }
  if (desired === 'capacity') {
    return 'capacity';
  }
  return 'all carried';
}

const ROUTE_ID = /\bRT-[A-Z0-9]+-\d+\b/gi;

export function routeIdsInText(text: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const match of text.matchAll(ROUTE_ID)) {
    const id = match[0].toUpperCase();
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(match[0]);
  }
  return ids;
}

export function newRouteId(before: string[], after: string[]): string | undefined {
  const prior = new Set(before.map(id => id.toUpperCase()));
  const added = after.filter(id => !prior.has(id.toUpperCase()));
  if (added.length !== 1) {
    return undefined;
  }
  return added[0];
}
