import { describe, expect, it } from 'vitest';
import { parseDataExplorerParameters } from '@src/features/XIT/DATA/parameters';

describe('parseDataExplorerParameters', () => {
  it.each([
    [[], { connectionEnabled: true }],
    [['ships'], { sourceId: 'ships', connectionEnabled: true }],
    [
      ['ships', 'ws://127.0.0.1:47800'],
      { sourceId: 'ships', endpoint: 'ws://127.0.0.1:47800', connectionEnabled: true },
    ],
    [
      ['ws://127.0.0.1:47800', 'JSON'],
      { endpoint: 'ws://127.0.0.1:47800', connectionEnabled: false },
    ],
    [
      ['json', 'ships', 'ws://127.0.0.1:47800'],
      { sourceId: 'ships', endpoint: 'ws://127.0.0.1:47800', connectionEnabled: false },
    ],
  ])('parses optional DATA parameters %#', (parameters, expected) => {
    expect(parseDataExplorerParameters(parameters)).toEqual(expected);
  });
});
