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

// Editor fills may click mode words only. SAVE has its own ACT-gated click; CANCEL and
// delete are never clicked.
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

// The route settings row renders the word Loop on the row and again on the switch.
export function isRouteLoopText(text: string): boolean {
  const value = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return value === 'loop' || value === 'loop loop';
}

// Staging route settings, 2026-10-02: the switch text is rgb(153, 153, 153) while
// off and rgb(221, 221, 221) while on. It does not gain an Active class.
export function loopSwitchLit(color: string): boolean {
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (match === null) {
    return false;
  }
  return Number(match[1]) >= 200 && Number(match[2]) >= 200 && Number(match[3]) >= 200;
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

const ROUTE_ID = /^RT-[A-Z0-9]+-\d+$/i;

// The RT list's textContent runs cells together ("RT-PNWB-20050--", "deleteRT-SNXV-3853"),
// so an id must be an element's whole text, never a match inside the joined blob.
export function routeIdsInCells(texts: string[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const raw of texts) {
    const text = raw.trim();
    const id = text.toUpperCase();
    if (!ROUTE_ID.test(text) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(text);
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

export type ShipAssignment =
  | { kind: 'missing' }
  | { kind: 'free'; row: number }
  | { kind: 'here' }
  | { kind: 'busy'; route: string; cmds: string };

// The route view's Assignments table is Name | Route | Cmds, one row per ship. A free ship
// shows `--` and an ASSIGN button; a ship on a route shows that route id instead.
export function shipAssignment(rows: string[][], names: string[], routeId: string): ShipAssignment {
  const wanted = new Set(names.map(name => name.trim().toLowerCase()).filter(n => n.length > 0));
  const index = rows.findIndex(cells => wanted.has((cells[0] ?? '').trim().toLowerCase()));
  if (index < 0) {
    return { kind: 'missing' };
  }
  const route = (rows[index][1] ?? '').trim();
  const cmds = (rows[index][2] ?? '').trim();
  if (route.toUpperCase() === routeId.trim().toUpperCase()) {
    return { kind: 'here' };
  }
  if (cmds.toUpperCase() === 'ASSIGN') {
    return { kind: 'free', row: index };
  }
  return { kind: 'busy', route, cmds };
}
