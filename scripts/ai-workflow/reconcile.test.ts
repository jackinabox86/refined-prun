import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { BuzzGateway, ChannelSummary } from './buzz.ts';
import { emptyStore, renderCanvas, type DesiredMember, type ReconcileRequest } from './model.ts';
import { WorkflowReconciler } from './reconcile.ts';
import { JsonMappingStore } from './store.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('WorkflowReconciler', () => {
  it('creates one channel, mapping, member set, and canvas', async () => {
    const { reconciler, buzz } = await harness();
    const result = await reconciler.reconcile(seed());

    expect(result.actions).toEqual([
      'created-channel',
      'reused-channel',
      `set-member:${HUMAN_PUBKEY}:owner`,
      'updated-canvas',
    ]);
    expect(buzz.createCount).toBe(1);
    expect(buzz.channels).toHaveLength(1);
    expect(buzz.canvas.get(result.mapping.buzz.channelId)).toBe(renderCanvas(result.mapping));
    expect(result.mapping.execution.observedState).toBe('active');
  });

  it('reconciles the same issue without duplicate writes', async () => {
    const { reconciler, buzz } = await harness();
    await reconciler.reconcile(seed());
    const result = await reconciler.reconcile({ key: 'JAC-6' });

    expect(result.actions).toEqual(['reused-channel', 'canvas-current']);
    expect(buzz.createCount).toBe(1);
    expect(buzz.setCanvasCount).toBe(1);
    expect(buzz.addMemberCount).toBe(1);
  });

  it('adds a new desired member without removing existing members', async () => {
    const { reconciler, buzz } = await harness();
    await reconciler.reconcile(seed());
    const secondPubkey = 'b'.repeat(64);
    const result = await reconciler.reconcile({
      key: 'JAC-6',
      members: [{ pubkey: secondPubkey, role: 'bot' }],
    });

    expect(result.mapping.buzz.members).toEqual([
      { pubkey: HUMAN_PUBKEY, role: 'owner' },
      { pubkey: secondPubkey, role: 'bot' },
    ]);
    expect(buzz.members.get(result.mapping.buzz.channelId)).toEqual([
      { pubkey: HUMAN_PUBKEY, role: 'owner' },
      { pubkey: secondPubkey, role: 'bot' },
    ]);
  });

  it('rejects conflicting immutable metadata', async () => {
    const { reconciler } = await harness();
    await reconciler.reconcile(seed());

    await expect(reconciler.reconcile({ key: 'JAC-6', branch: 'wrong-branch' })).rejects.toThrow(
      'Stored mapping conflicts with --branch',
    );
  });

  it('rejects conflicting channel policy metadata', async () => {
    const { reconciler } = await harness();
    await reconciler.reconcile(seed());

    await expect(
      reconciler.reconcile({ key: 'JAC-6', channelVisibility: 'private' }),
    ).rejects.toThrow('Stored mapping conflicts with --channel-visibility');
  });

  it('refuses to adopt an existing channel implicitly', async () => {
    const { reconciler, buzz } = await harness();
    buzz.channels.push({ channelId: 'existing', name: CHANNEL_NAME, description: '' });

    await expect(reconciler.reconcile(seed())).rejects.toThrow('rerun with --adopt-existing');
    expect(buzz.createCount).toBe(0);
  });

  it('adopts one explicitly verified existing channel', async () => {
    const { reconciler, buzz } = await harness();
    buzz.channels.push({ channelId: 'existing', name: CHANNEL_NAME, description: '' });
    const result = await reconciler.reconcile({ ...seed(), adoptExisting: true });

    expect(result.mapping.buzz.channelId).toBe('existing');
    expect(result.actions[0]).toBe('adopted-channel');
    expect(buzz.createCount).toBe(0);
  });

  it('rejects ambiguous existing channel names', async () => {
    const { reconciler, buzz } = await harness();
    buzz.channels.push(
      { channelId: 'one', name: CHANNEL_NAME, description: '' },
      { channelId: 'two', name: CHANNEL_NAME, description: '' },
    );

    await expect(reconciler.reconcile({ ...seed(), adoptExisting: true })).rejects.toThrow(
      'Multiple visible Buzz channels',
    );
  });

  it('records a recoverable external error and resumes on retry', async () => {
    const { reconciler, buzz } = await harness();
    buzz.failNextCanvasWrite = true;

    await expect(reconciler.reconcile(seed())).rejects.toThrow('canvas write failed');
    const failed = await reconciler.inspect('JAC-6');
    expect(failed.execution.observedState).toBe('error');
    expect(failed.execution.lastError).toBe('canvas write failed');

    const recovered = await reconciler.reconcile({ key: 'JAC-6' });
    expect(recovered.mapping.execution.observedState).toBe('active');
    expect(recovered.mapping.execution.lastError).toBeNull();
    expect(buzz.createCount).toBe(1);
  });

  it('requires explicit confirmation before archiving', async () => {
    const { reconciler, buzz } = await harness();
    await reconciler.reconcile(seed());

    await expect(reconciler.archive('JAC-6', false)).rejects.toThrow('Archive requires --confirm');
    expect(buzz.archiveCount).toBe(0);
  });

  it('archives once and preserves the archived mapping on later reconcile', async () => {
    const { reconciler, buzz } = await harness();
    await reconciler.reconcile(seed());
    const first = await reconciler.archive('JAC-6', true);
    const second = await reconciler.archive('JAC-6', true);
    const recovered = await reconciler.reconcile({ key: 'JAC-6' });

    expect(first.actions).toEqual(['archived-channel']);
    expect(second.actions).toEqual(['already-archived']);
    expect(recovered.actions).toEqual(['preserved-archived-channel']);
    expect(buzz.archiveCount).toBe(1);
    expect(buzz.createCount).toBe(1);
  });
});

describe('JsonMappingStore', () => {
  it('rejects a duplicate Buzz channel invariant', async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, 'mappings.json');
    const store = new JsonMappingStore(path);
    const { reconciler } = await harness(path);
    const first = await reconciler.reconcile(seed());
    const data = await store.read();
    data.mappings['JAC-7'] = {
      ...structuredClone(first.mapping),
      linear: { ...structuredClone(first.mapping.linear), key: 'JAC-7' },
    };

    await expect(store.write(data)).rejects.toThrow('Duplicate Buzz channel mapping');
  });

  it('rejects an unsupported schema', async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, 'mappings.json');
    await writeFile(path, JSON.stringify({ ...emptyStore(), schemaVersion: 99 }), 'utf8');

    await expect(new JsonMappingStore(path).read()).rejects.toThrow(
      'Unsupported mapping store schema',
    );
  });

  it('rejects an incomplete mapping record', async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, 'mappings.json');
    await writeFile(
      path,
      JSON.stringify({ schemaVersion: 1, mappings: { 'JAC-6': { schemaVersion: 1 } } }),
      'utf8',
    );

    await expect(new JsonMappingStore(path).read()).rejects.toThrow(
      'Invalid mapping record: JAC-6',
    );
  });

  it('serializes local writers with a lock file', async () => {
    const directory = await temporaryDirectory();
    const store = new JsonMappingStore(join(directory, 'mappings.json'));

    await store.withLock(async () => {
      await expect(store.withLock(async () => undefined)).rejects.toThrow(
        'Mapping store is locked by another reconcile process',
      );
    });
  });
});

const HUMAN_PUBKEY = 'a'.repeat(64);
const CHANNEL_NAME = 'JAC-6-linear-buzz-reconciler';

function seed(): ReconcileRequest {
  return {
    key: 'JAC-6',
    title: '[Phase 2] Build and prove the Linear-Buzz reconciler',
    linearUrl: 'https://linear.app/example/issue/JAC-6/example',
    teamId: 'team-id',
    statusIds: {
      todo: 'todo-id',
      inProgress: 'progress-id',
      inReview: 'review-id',
      done: 'done-id',
    },
    channelName: CHANNEL_NAME,
    repository: 'https://github.com/example/repo',
    branch: CHANNEL_NAME,
    worktree: '/worktrees/JAC-6-linear-buzz-reconciler',
    owner: 'Codex Sol',
    members: [{ pubkey: HUMAN_PUBKEY, role: 'owner' }],
  };
}

async function harness(storePath?: string) {
  const directory = storePath === undefined ? await temporaryDirectory() : undefined;
  const store = new JsonMappingStore(storePath ?? join(directory!, 'mappings.json'));
  const buzz = new MemoryBuzz();
  const reconciler = new WorkflowReconciler(
    store,
    buzz,
    () => new Date('2026-08-14T03:00:00.000Z'),
  );
  return { store, buzz, reconciler };
}

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'ai-workflow-'));
  temporaryDirectories.push(directory);
  return directory;
}

class MemoryBuzz implements BuzzGateway {
  channels: ChannelSummary[] = [];
  members = new Map<string, DesiredMember[]>();
  canvas = new Map<string, string>();
  archived = new Set<string>();
  createCount = 0;
  addMemberCount = 0;
  setCanvasCount = 0;
  archiveCount = 0;
  failNextCanvasWrite = false;

  async listChannels() {
    return structuredClone(this.channels);
  }

  async createChannel(input: {
    name: string;
    description: string;
    type: 'stream' | 'forum';
    visibility: 'open' | 'private';
  }) {
    this.createCount += 1;
    const channel = {
      channelId: `channel-${this.createCount}`,
      name: input.name,
      description: input.description,
    };
    this.channels.push(channel);
    this.members.set(channel.channelId, []);
    return structuredClone(channel);
  }

  async getChannel(channelId: string) {
    const channel = this.channels.find(x => x.channelId === channelId);
    if (channel === undefined) {
      throw new Error(`missing channel ${channelId}`);
    }
    return structuredClone(channel);
  }

  async listMembers(channelId: string) {
    return structuredClone(this.members.get(channelId) ?? []);
  }

  async addMember(channelId: string, member: DesiredMember) {
    this.addMemberCount += 1;
    const members = this.members.get(channelId) ?? [];
    const existing = members.find(x => x.pubkey === member.pubkey);
    if (existing === undefined) {
      members.push(structuredClone(member));
    } else {
      existing.role = member.role;
    }
    this.members.set(channelId, members);
  }

  async getCanvas(channelId: string) {
    return this.canvas.get(channelId) ?? null;
  }

  async setCanvas(channelId: string, content: string) {
    if (this.failNextCanvasWrite) {
      this.failNextCanvasWrite = false;
      throw new Error('canvas write failed');
    }
    this.setCanvasCount += 1;
    this.canvas.set(channelId, content);
  }

  async archiveChannel(channelId: string) {
    this.archiveCount += 1;
    this.archived.add(channelId);
  }
}
