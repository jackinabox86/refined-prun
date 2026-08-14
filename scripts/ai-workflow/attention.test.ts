import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AttentionProjector } from './attention.ts';
import { createMapping, emptyStore, type ReconcileRequest } from './model.ts';
import { JsonMappingStore } from './store.ts';

const temporaryDirectories: string[] = [];
const NOW = '2026-08-14T12:00:00.000Z';

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('AttentionProjector', () => {
  it('requires an explicit repository-scoped opt in', async () => {
    const { projector, store } = await harness();
    const disabled = await projector.observe(progress());
    await enable(projector);
    const data = await store.read();

    expect(disabled.actions).toEqual([{ type: 'none', reason: 'attention-policy-disabled' }]);
    expect(data.attentionPolicies['team-id'][REPOSITORY]).toMatchObject({
      enabled: true,
      staleAfterSeconds: 300,
      maxSignals: 100,
    });
  });

  it('records one replay-safe healthy heartbeat', async () => {
    const { projector } = await harness(true);
    const first = await projector.observe(progress());
    const duplicate = await projector.observe(progress());

    expect(first.actions).toEqual([{ type: 'none', reason: 'progress-recorded' }]);
    expect(first.mapping.attention.status).toBe('healthy');
    expect(first.mapping.attention.lastProgressAt).toBe(NOW);
    expect(duplicate.actions).toEqual([{ type: 'none', reason: 'duplicate-heartbeat' }]);
    expect(duplicate.mapping.attention.signals).toHaveLength(1);
  });

  it('rejects a conflicting payload that reuses a heartbeat identity', async () => {
    const { projector } = await harness(true);
    await projector.observe(progress());

    await expect(projector.observe({ ...progress(), reason: 'different payload' })).rejects.toThrow(
      'identity conflicts',
    );
  });

  it('emits one needs-human action for a stale heartbeat and infers a lost acknowledgment', async () => {
    const { projector } = await harness(true);
    await projector.observe(progress());
    const stale = await projector.reconcile({
      issueKey: 'JAC-8',
      linearState: 'in-progress',
      linearNeedsHuman: false,
      now: '2026-08-14T12:06:00.000Z',
    });
    const duplicate = await projector.reconcile({
      issueKey: 'JAC-8',
      linearState: 'in-progress',
      linearNeedsHuman: false,
      now: '2026-08-14T12:06:01.000Z',
    });
    const inferred = await projector.reconcile({
      issueKey: 'JAC-8',
      linearState: 'in-progress',
      linearNeedsHuman: true,
      now: '2026-08-14T12:06:02.000Z',
    });

    expect(stale.actions).toEqual([
      { type: 'needs-attention', reason: 'heartbeat-stale' },
      {
        type: 'set-linear-needs-human',
        issueKey: 'JAC-8',
        deliveryId: `heartbeat-stale:${NOW}:set`,
        enabled: true,
        reason: 'heartbeat-stale',
      },
    ]);
    expect(duplicate.actions).toEqual([
      { type: 'none', reason: 'attention-delivery-awaiting-ack' },
    ]);
    expect(inferred.actions).toEqual([
      { type: 'none', reason: 'inferred-attention-applied-from-linear-label' },
    ]);
    expect(inferred.mapping.attention.label.outcome).toBe('applied');
  });

  it('clears attention only through an explicit recovery signal', async () => {
    const { projector } = await harness(true);
    await projector.observe(progress());
    const stalled = await projector.observe({
      issueKey: 'JAC-8',
      eventId: 'heartbeat:stall:1',
      kind: 'stall',
      owner: 'Codex Sol',
      observedAt: '2026-08-14T12:01:00.000Z',
      reason: 'waiting-for-human-decision',
    });
    await projector.acknowledge({
      issueKey: 'JAC-8',
      deliveryId: 'attention:heartbeat:stall:1:set',
      result: 'applied',
    });
    const progressWhileStalled = await projector.observe({
      ...progress(),
      eventId: 'heartbeat:progress:2',
      observedAt: '2026-08-14T12:02:00.000Z',
    });
    const recovered = await projector.observe({
      issueKey: 'JAC-8',
      eventId: 'heartbeat:recovery:1',
      kind: 'recovery',
      owner: 'Codex Sol',
      observedAt: '2026-08-14T12:03:00.000Z',
      reason: 'decision-received',
    });

    expect(stalled.mapping.attention.status).toBe('attention');
    expect(progressWhileStalled.mapping.attention.status).toBe('attention');
    expect(recovered.mapping.attention.status).toBe('recovered');
    expect(recovered.mapping.attention.stallReason).toBeNull();
    expect(recovered.actions).toEqual([
      {
        type: 'set-linear-needs-human',
        issueKey: 'JAC-8',
        deliveryId: 'attention:heartbeat:recovery:1:clear',
        enabled: false,
        reason: 'decision-received',
      },
    ]);
  });

  it('hands off the same branch and worktree to a new owner', async () => {
    const { projector } = await harness(true);
    await projector.observe(progress());
    const handedOff = await projector.observe({
      issueKey: 'JAC-8',
      eventId: 'heartbeat:handoff:1',
      kind: 'handoff',
      owner: 'Codex Sol',
      nextOwner: 'Codex Terra',
      observedAt: '2026-08-14T12:01:00.000Z',
      reason: 'verification-owner',
    });

    expect(handedOff.mapping.execution.owner).toBe('Codex Terra');
    expect(handedOff.mapping.git.branch).toBe('JAC-8-structured-attention-heartbeat');
    expect(handedOff.mapping.git.worktree).toBe('/worktrees/JAC-8');
    await expect(
      projector.observe({
        ...progress(),
        eventId: 'heartbeat:progress:old-owner',
        observedAt: '2026-08-14T12:02:00.000Z',
      }),
    ).rejects.toThrow('does not match current owner');
  });

  it('retries one failed label delivery and bounds signal history', async () => {
    const { projector } = await harness();
    await projector.configure({
      issueKey: 'JAC-8',
      enabled: true,
      staleAfterSeconds: 300,
      maxSignals: 1,
    });
    await projector.observe(progress());
    const stalled = await projector.observe({
      issueKey: 'JAC-8',
      eventId: 'heartbeat:stall:1',
      kind: 'stall',
      owner: 'Codex Sol',
      observedAt: '2026-08-14T12:01:00.000Z',
      reason: 'blocked',
    });
    await projector.acknowledge({
      issueKey: 'JAC-8',
      deliveryId: 'attention:heartbeat:stall:1:set',
      result: 'failed',
      error: 'Linear unavailable',
    });
    const retry = await projector.reconcile({
      issueKey: 'JAC-8',
      linearState: 'in-progress',
      linearNeedsHuman: false,
      now: '2026-08-14T12:01:01.000Z',
    });

    expect(stalled.mapping.attention.signals).toHaveLength(1);
    expect(retry.mapping.attention.signals).toHaveLength(1);
    expect(retry.mapping.attention.signals[0].id).toBe('heartbeat:stall:1');
    expect(retry.actions[0]).toMatchObject({
      type: 'set-linear-needs-human',
      enabled: true,
    });
    expect(retry.mapping.attention.label.attempts).toBe(2);
  });
});

function progress() {
  return {
    issueKey: 'JAC-8',
    eventId: 'heartbeat:progress:1',
    kind: 'progress' as const,
    owner: 'Codex Sol',
    observedAt: NOW,
  };
}

async function enable(projector: AttentionProjector) {
  await projector.configure({
    issueKey: 'JAC-8',
    enabled: true,
    staleAfterSeconds: 300,
    maxSignals: 100,
  });
}

async function harness(enablePolicy = false) {
  const directory = await mkdtemp(join(tmpdir(), 'ai-workflow-attention-'));
  temporaryDirectories.push(directory);
  const store = new JsonMappingStore(join(directory, 'mappings.json'));
  const data = emptyStore();
  data.mappings['JAC-8'] = createMapping(seed(), 'channel-id', NOW);
  await store.write(data);
  const projector = new AttentionProjector(store, () => new Date(NOW));
  if (enablePolicy) {
    await enable(projector);
  }
  return { projector, store };
}

const REPOSITORY = 'https://github.com/example/repo';

function seed(): ReconcileRequest {
  return {
    key: 'JAC-8',
    title: '[Phase 4] Add structured attention, heartbeat, and safe archival',
    linearUrl: 'https://linear.app/example/issue/JAC-8/example',
    teamId: 'team-id',
    statusIds: {
      todo: 'todo-id',
      inProgress: 'progress-id',
      inReview: 'review-id',
      done: 'done-id',
    },
    channelName: 'JAC-8-structured-attention-heartbeat',
    repository: REPOSITORY,
    branch: 'JAC-8-structured-attention-heartbeat',
    worktree: '/worktrees/JAC-8',
    owner: 'Codex Sol',
  };
}
