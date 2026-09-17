import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'tile-overlay.ts'), 'utf8');
const showBody = source.slice(
  source.indexOf('export function showTileOverlay'),
  source.indexOf('export function showConfirmationOverlay'),
);

describe('showTileOverlay', () => {
  it('opens the overlay at the top of the host scroll view', () => {
    expect(showBody).toContain('scrollView.scrollTop = 0');
    // The host keeps the hidden content's scroll position, so the reset has to happen
    // after the overlay is in the DOM, not before.
    expect(showBody.indexOf('fragmentApp.appendTo(scrollView)')).toBeLessThan(
      showBody.indexOf('scrollView.scrollTop = 0'),
    );
  });

  it('hands back an idempotent close handle', () => {
    expect(showBody).toContain('return close;');
    // A backdrop dismissal and the caller's own close both land here.
    expect(showBody).toContain('if (closed) {');
    expect(showBody).toContain('closed = true;');
  });
});
