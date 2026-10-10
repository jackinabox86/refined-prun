import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { applyDismissSelectionBlock } from './dismiss-selection';

const here = dirname(fileURLToPath(import.meta.url));
const warning = readFileSync(join(here, 'PriceThresholdWarning.vue'), 'utf8');

describe('CX price warning DISMISS selection', () => {
  it('blocks a primary DISMISS press and clears a selection the ACT click already started', () => {
    let prevented = false;
    const removeAllRanges = vi.fn();
    applyDismissSelectionBlock(
      {
        button: 0,
        preventDefault: () => {
          prevented = true;
        },
      },
      false,
      { removeAllRanges },
    );
    expect(prevented).toBe(true);
    expect(removeAllRanges).toHaveBeenCalledOnce();
  });

  it('does not block selection on an editable control', () => {
    const preventDefault = vi.fn();
    const removeAllRanges = vi.fn();
    applyDismissSelectionBlock({ button: 0, preventDefault }, true, { removeAllRanges });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(removeAllRanges).not.toHaveBeenCalled();
  });

  it('does not block a non-primary button', () => {
    const preventDefault = vi.fn();
    applyDismissSelectionBlock({ button: 2, preventDefault }, false, {
      removeAllRanges: vi.fn(),
    });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('keeps the handler on DISMISS and still closes from the click', () => {
    const button = warning.slice(warning.indexOf('<PrunButton'), warning.indexOf('</PrunButton>'));
    expect(button).toContain('@mousedown="onDismissMouseDown"');
    expect(button).toContain('DISMISS');
    expect(button).toContain('@click="emit(\'close\')"');
    expect(warning.match(/@mousedown/g)).toHaveLength(1);
    expect(warning).toContain('closest(\'input, textarea, select, [contenteditable="true"]\')');
    expect(warning).toContain('applyDismissSelectionBlock');
    expect(warning).not.toContain('stopPropagation');
    expect(warning).not.toContain('addEventListener');
  });
});
