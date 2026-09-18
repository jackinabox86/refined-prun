import { TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { describe, expect, it, vi } from 'vitest';
import { addMissingLocalizationEntries, generateLocalizationTree } from './localization-tree';
import { createLocalizationProxy } from './localization-proxy';
import { sanitizeKey } from './sanitize-key';
import { applyLocalizationPatch, lookupLocalization } from './index';

vi.mock('@src/infrastructure/prun-api/data/materials', () => ({
  materialsStore: { all: { value: [] } },
}));

function literal(value: string): MessageFormatElement[] {
  return [{ type: TYPE.literal, value }];
}

// The proxy target is a function; traps add nested properties only at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LOf(tree: ReturnType<typeof generateLocalizationTree>): any {
  return createLocalizationProxy(tree, 'L');
}

describe('sanitizeKey', () => {
  it('keeps a valid identifier', () => {
    expect(sanitizeKey('CompanyPanel')).toBe('CompanyPanel');
  });

  it('prefixes reserved words and digits', () => {
    expect(sanitizeKey('float')).toBe('_float');
    expect(sanitizeKey('2fa')).toBe('_2fa');
  });

  it('replaces invalid characters', () => {
    expect(sanitizeKey('foo-bar')).toBe('foo_bar');
  });
});

describe('localization tree and proxy', () => {
  it('formats a nested literal key', () => {
    const tree = generateLocalizationTree({
      'CompanyPanel.data.bases': literal('Bases'),
    });
    const L = LOf(tree);
    expect(L.CompanyPanel.data.bases()).toBe('Bases');
  });

  it('fills missing destination keys from the English fallback', () => {
    const destination = {
      'CompanyPanel.data.bases': literal('Bases'),
    };
    addMissingLocalizationEntries(destination, {
      'CompanyPanel.data.bases': literal('Bases'),
      'CompanyPanel.data.code': literal('Code'),
    });
    const tree = generateLocalizationTree(destination);
    const L = LOf(tree);
    expect(L.CompanyPanel.data.code()).toBe('Code');
  });

  it('indexes a subtree with lookupLocalization', () => {
    const tree = generateLocalizationTree({
      'StoreTypeLabel.STORE': literal('Inventory'),
      'StoreTypeLabel.STORE_SHORT': literal('INV'),
    });
    const L = LOf(tree);
    expect(lookupLocalization(L.StoreTypeLabel, 'STORE')()).toBe('Inventory');
    expect(lookupLocalization(L.StoreTypeLabel, 'STORE_SHORT')()).toBe('INV');
  });

  it('does not throw on a missing path and resolves undefined at the terminal call', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tree = generateLocalizationTree({
      'CompanyPanel.data.bases': literal('Bases'),
    });
    const L = LOf(tree);
    expect(L.Missing.branch.key()).toBeUndefined();
    expect(L.Missing.branch.key.getFormat()).toBeUndefined();
    expect(String(L.Missing.branch.key)).toBe('undefined');
    error.mockRestore();
  });

  it('patches a leaf AST so later calls return the new text', () => {
    const tree = generateLocalizationTree({
      'SiteWorkforces.table.currentWorkforce': literal('Current Workforce'),
    });
    const leaf = tree.SiteWorkforces.table.currentWorkforce as LiteralLocalizationLeaf;
    applyLocalizationPatch(leaf, value => value.replace('Current Workforce', 'Current'));
    expect(leaf()).toBe('Current');
  });
});
