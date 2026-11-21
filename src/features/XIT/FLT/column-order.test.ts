import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLUMN_ORDER,
  FLT_COLUMN_PICKER_LABELS,
  FLT_PICKER_COLUMN_IDS,
  fullOrderFromPicker,
  normalizeColumnOrder,
  pickerOrderFrom,
  sameColumnOrder,
  shouldApplyColumnToggle,
} from './column-order';

const here = dirname(fileURLToPath(import.meta.url));
const flt = readFileSync(join(here, 'FLT.vue'), 'utf8');

describe('XIT FLT column order', () => {
  it("keeps today's default order for an empty or partial saved list", () => {
    expect(normalizeColumnOrder([])).toEqual([...DEFAULT_COLUMN_ORDER]);
    expect(normalizeColumnOrder(['fuel', 'name'])).toEqual([
      'fuel',
      'name',
      'shipClass',
      'size',
      'cargo',
      'cargoSize',
      'status',
      'time',
      'repair',
      'route',
      'problems',
    ]);
  });

  it('drops unknown ids and duplicates while preserving relative order', () => {
    expect(normalizeColumnOrder(['name', 'bogus', 'name', 'route'])).toEqual([
      'name',
      'route',
      'shipClass',
      'size',
      'cargo',
      'cargoSize',
      'status',
      'time',
      'repair',
      'fuel',
      'problems',
    ]);
  });

  it('keeps Status out of the picker and restores it at the prior index', () => {
    expect(pickerOrderFrom([...DEFAULT_COLUMN_ORDER])).toEqual([...FLT_PICKER_COLUMN_IDS]);
    expect(FLT_PICKER_COLUMN_IDS).not.toContain('status');

    const moved = [
      'time',
      'name',
      'shipClass',
      'size',
      'cargo',
      'cargoSize',
      'repair',
      'fuel',
      'route',
      'problems',
    ] as const;
    expect(fullOrderFromPicker(moved, [...DEFAULT_COLUMN_ORDER])).toEqual([
      'time',
      'name',
      'shipClass',
      'size',
      'cargo',
      'status',
      'cargoSize',
      'repair',
      'fuel',
      'route',
      'problems',
    ]);
  });

  it('does not apply a column toggle while a drag is active', () => {
    expect(shouldApplyColumnToggle(false)).toBe(true);
    expect(shouldApplyColumnToggle(true)).toBe(false);
  });

  it('compares column orders by identity sequence', () => {
    expect(sameColumnOrder(['name', 'cargo'], ['name', 'cargo'])).toBe(true);
    expect(sameColumnOrder(['name', 'cargo'], ['cargo', 'name'])).toBe(false);
  });

  it('wires the Columns picker to vue-draggable-plus and ordered rendering', () => {
    expect(flt).toContain('v-draggable="columnDragBinding"');
    expect(flt).toContain('shouldApplyColumnToggle(columnDragActive.value)');
    expect(flt).toContain('v-for="col in orderedVisibleColumns"');
    expect(flt).toContain('FLT_COLUMN_PICKER_LABELS');
    expect(FLT_COLUMN_PICKER_LABELS.cargoSize).toBe('CARGO/SIZE');
  });
});
