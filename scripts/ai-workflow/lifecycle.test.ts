import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LifecycleProjector } from './lifecycle.ts';
import { createMapping, emptyStore, type ReconcileRequest } from './model.ts';
import { JsonMappingStore } from './store.ts';

const temporaryDirectories: string[] = [];
const NOW = '2026-08-14T12:00:00.000Z';

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('LifecycleProjector', () => {
  it('requires an explicit per-team opt in', async () => {
    const { projector } = await harness();
    const result = await projector.observe(event());

    expect(result.actions).toEqual([{ type: 'none', reason: 'projection-disabled' }]);
    expect(result.mapping.lifecycle.deliveries[0].outcome).toBe('ignored');
  });

  it('plans one Linear write and suppresses duplicate delivery while awaiting acknowledgment', async () => {
    const { projector } = await harness(true);
    const first = await projector.observe(event());
    const duplicate = await projector.observe(event());

    expect(first.actions).toEqual([
      {
        type: 'set-linear-status',
        issueKey: 'JAC-7',
        deliveryId: 'github:pr:152:ready',
        statusId: 'review-id',
        reason: 'eligible-review-event',
      },
    ]);
    expect(duplicate.actions).toEqual([{ type: 'none', reason: 'duplicate-event-awaiting-ack' }]);
    expect(duplicate.mapping.lifecycle.deliveries).toHaveLength(1);
    expect(duplicate.mapping.lifecycle.deliveries[0].attempts).toBe(1);
  });

  it('keeps failed writes retryable and clears the alert after acknowledgment', async () => {
    const { projector } = await harness(true);
    await projector.observe(event());
    const failed = await projector.acknowledge({
      issueKey: 'JAC-7',
      eventId: 'github:pr:152:ready',
      result: 'failed',
      error: 'Linear unavailable',
    });
    const retry = await projector.observe(event());
    const applied = await projector.acknowledge({
      issueKey: 'JAC-7',
      eventId: 'github:pr:152:ready',
      result: 'applied',
    });

    expect(failed.mapping.lifecycle.alert.state).toBe('attention');
    expect(retry.actions[0]).toMatchObject({
      type: 'set-linear-status',
      reason: 'retry-failed-delivery',
    });
    expect(retry.mapping.lifecycle.deliveries[0].attempts).toBe(2);
    expect(applied.mapping.lifecycle.deliveries[0].outcome).toBe('applied');
    expect(applied.mapping.lifecycle.alert.state).toBe('clear');
  });

  it('re-emits one stale pending delivery and stores one attention signal', async () => {
    const { projector } = await harness(true);
    await projector.observe(event());
    const result = await projector.reconcile({
      issueKey: 'JAC-7',
      linearState: 'in-progress',
      now: '2026-08-14T12:06:00.000Z',
    });

    expect(result.actions).toEqual([
      {
        type: 'needs-attention',
        deliveryId: 'github:pr:152:ready',
        reason: 'retry-stale-delivery',
      },
      {
        type: 'set-linear-status',
        issueKey: 'JAC-7',
        deliveryId: 'github:pr:152:ready',
        statusId: 'review-id',
        reason: 'retry-stale-delivery',
      },
    ]);
    expect(result.mapping.lifecycle.alert).toMatchObject({
      state: 'attention',
      deliveryId: 'github:pr:152:ready',
    });
  });

  it('infers a lost acknowledgment from current Linear truth', async () => {
    const { projector } = await harness(true);
    await projector.observe(event());
    const result = await projector.reconcile({
      issueKey: 'JAC-7',
      linearState: 'in-review',
    });

    expect(result.actions).toEqual([
      { type: 'none', reason: 'inferred-applied-from-linear-state' },
    ]);
    expect(result.mapping.lifecycle.deliveries[0].outcome).toBe('applied');
    expect(result.mapping.lifecycle.alert.state).toBe('clear');
  });

  it('never regresses Done for pending, duplicate, or delayed review events', async () => {
    const { projector } = await harness(true);
    await projector.observe(event());
    const reconciled = await projector.reconcile({ issueKey: 'JAC-7', linearState: 'done' });
    const duplicate = await projector.observe({ ...event(), linearState: 'done' });
    const delayed = await projector.observe({
      ...event(),
      eventId: 'github:pr:152:late-review',
      eventKind: 'review-activity',
      linearState: 'done',
    });

    expect(reconciled.mapping.lifecycle.deliveries[0]).toMatchObject({
      outcome: 'ignored',
      reason: 'linear-terminal-done',
    });
    expect(duplicate.actions).toEqual([
      { type: 'none', reason: 'duplicate-event-linear-terminal-done' },
    ]);
    expect(delayed.actions).toEqual([{ type: 'none', reason: 'linear-terminal-done' }]);
    expect(delayed.actions.some(x => x.type === 'set-linear-status')).toBe(false);
  });

  it('bounds the ledger by pruning the oldest resolved delivery', async () => {
    const { projector } = await harness();
    await projector.configure({
      issueKey: 'JAC-7',
      enabled: true,
      staleAfterSeconds: 300,
      maxDeliveries: 1,
    });
    await projector.observe({ ...event(), linearState: 'done' });
    const result = await projector.observe({
      ...event(),
      eventId: 'github:pr:152:review',
      eventKind: 'review-activity',
    });

    expect(result.mapping.lifecycle.deliveries).toHaveLength(1);
    expect(result.mapping.lifecycle.deliveries[0].id).toBe('github:pr:152:review');
  });

  it('rejects conflicting payloads that reuse a delivery identity', async () => {
    const { projector } = await harness(true);
    await projector.observe(event());

    await expect(projector.observe({ ...event(), eventKind: 'review-activity' })).rejects.toThrow(
      'identity conflicts',
    );
  });
});

function event() {
  return {
    issueKey: 'JAC-7',
    eventId: 'github:pr:152:ready',
    eventKind: 'ready-for-review' as const,
    source: 'https://github.com/example/repo/pull/152',
    linearState: 'in-progress' as const,
    observedAt: NOW,
  };
}

async function harness(enable = false) {
  const directory = await mkdtemp(join(tmpdir(), 'ai-workflow-lifecycle-'));
  temporaryDirectories.push(directory);
  const store = new JsonMappingStore(join(directory, 'mappings.json'));
  const data = emptyStore();
  data.mappings['JAC-7'] = createMapping(seed(), 'channel-id', NOW);
  await store.write(data);
  const projector = new LifecycleProjector(store, () => new Date(NOW));
  if (enable) {
    await projector.configure({
      issueKey: 'JAC-7',
      enabled: true,
      staleAfterSeconds: 300,
      maxDeliveries: 100,
    });
  }
  return { projector, store };
}

function seed(): ReconcileRequest {
  return {
    key: 'JAC-7',
    title: '[Phase 3] Add replay-safe In Review projection',
    linearUrl: 'https://linear.app/example/issue/JAC-7/example',
    teamId: 'team-id',
    statusIds: {
      todo: 'todo-id',
      inProgress: 'progress-id',
      inReview: 'review-id',
      done: 'done-id',
    },
    channelName: 'JAC-7-replay-safe-in-review',
    repository: 'https://github.com/example/repo',
    branch: 'JAC-7-replay-safe-in-review',
    worktree: '/worktrees/JAC-7-replay-safe-in-review',
    owner: 'Codex Sol',
  };
}
