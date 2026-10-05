import { describe, expect, it } from 'vitest';
import {
  collapsedContractMarker,
  collapseLongContractRows,
} from '@src/features/XIT/CONTC/collapse-contract-rows';

function row(contractId: string, conditionId: string) {
  return { contract: { id: contractId }, condition: { id: conditionId } };
}

function labels<T extends { contract: { id: string }; condition: { id: string } }>(
  rows: readonly T[],
) {
  return collapseLongContractRows(rows).map(x =>
    x.kind === 'condition' ? x.row.condition.id : collapsedContractMarker,
  );
}

describe('collapseLongContractRows', () => {
  it('keeps every row when a contract has at most three', () => {
    const rows = [row('a', '1'), row('a', '2'), row('a', '3'), row('b', '4')];
    expect(labels(rows)).toEqual(['1', '2', '3', '4']);
  });

  it('shows three rows, then the marker, then the next contract', () => {
    const rows = [
      row('a', '1'),
      row('a', '2'),
      row('a', '3'),
      row('a', '4'),
      row('a', '5'),
      row('b', '6'),
    ];
    expect(labels(rows)).toEqual(['1', '2', '3', collapsedContractMarker, '6']);
  });

  it('puts the marker on the fourth occurrence when other contracts sit between', () => {
    const rows = [
      row('a', '1'),
      row('a', '2'),
      row('b', '3'),
      row('a', '4'),
      row('a', '5'),
      row('a', '6'),
    ];
    expect(labels(rows)).toEqual(['1', '2', '3', '4', collapsedContractMarker]);
  });

  it('collapses each long contract on its own', () => {
    const rows = [
      row('a', '1'),
      row('a', '2'),
      row('a', '3'),
      row('a', '4'),
      row('b', '5'),
      row('b', '6'),
      row('b', '7'),
      row('b', '8'),
    ];
    expect(labels(rows)).toEqual([
      '1',
      '2',
      '3',
      collapsedContractMarker,
      '5',
      '6',
      '7',
      collapsedContractMarker,
    ]);
  });
});
