import type { BuzzGateway } from './buzz.ts';
import {
  assertCreationRequest,
  assertRequestCompatible,
  createMapping,
  mergeDesiredMembers,
  normalizeIssueKey,
  renderCanvas,
  type ReconcileRequest,
  type TaskMapping,
} from './model.ts';
import { JsonMappingStore } from './store.ts';

export interface ReconcileResult {
  mapping: TaskMapping;
  actions: string[];
}

export class WorkflowReconciler {
  readonly store: JsonMappingStore;
  readonly buzz: BuzzGateway;
  readonly now: () => Date;

  constructor(store: JsonMappingStore, buzz: BuzzGateway, now = () => new Date()) {
    this.store = store;
    this.buzz = buzz;
    this.now = now;
  }

  async reconcile(request: ReconcileRequest) {
    return await this.store.withLock(async () => {
      const data = await this.store.read();
      const key = normalizeIssueKey(request.key);
      let mapping = data.mappings[key];
      const actions: string[] = [];

      if (mapping !== undefined) {
        assertRequestCompatible(mapping, request);
        mergeDesiredMembers(mapping, request.members);
        if (mapping.execution.desiredState === 'archived') {
          actions.push('preserved-archived-channel');
          return { mapping, actions } satisfies ReconcileResult;
        }
      } else {
        mapping = await this.createOrAdoptMapping(request, actions);
        data.mappings[key] = mapping;
        await this.store.write(data);
      }

      try {
        const channel = await this.buzz.getChannel(mapping.buzz.channelId);
        if (channel.name !== mapping.buzz.channelName) {
          throw new Error(
            `Mapped Buzz channel was renamed from ${mapping.buzz.channelName} to ${channel.name}`,
          );
        }
        actions.push('reused-channel');
        await this.ensureMembers(mapping, actions);

        mapping.execution.observedState = 'active';
        mapping.execution.lastError = null;
        mapping.execution.updatedAt = this.now().toISOString();
        const desiredCanvas = renderCanvas(mapping, data.teamPolicies[mapping.linear.teamId]);
        const currentCanvas = await this.buzz.getCanvas(mapping.buzz.channelId);
        if (currentCanvas === desiredCanvas) {
          actions.push('canvas-current');
        } else {
          await this.buzz.setCanvas(mapping.buzz.channelId, desiredCanvas);
          actions.push('updated-canvas');
        }
        await this.store.write(data);
        return { mapping, actions } satisfies ReconcileResult;
      } catch (error) {
        mapping.execution.observedState = 'error';
        mapping.execution.lastError = errorMessage(error);
        mapping.execution.updatedAt = this.now().toISOString();
        await this.store.write(data);
        throw error;
      }
    });
  }

  async inspect(issueKey: string) {
    const data = await this.store.read();
    const key = normalizeIssueKey(issueKey);
    const mapping = data.mappings[key];
    if (mapping === undefined) {
      throw new Error(`No mapping exists for ${key}`);
    }
    return mapping;
  }

  async archive(issueKey: string, confirmed: boolean) {
    if (!confirmed) {
      throw new Error('Archive requires --confirm');
    }
    return await this.store.withLock(async () => {
      const data = await this.store.read();
      const key = normalizeIssueKey(issueKey);
      const mapping = data.mappings[key];
      if (mapping === undefined) {
        throw new Error(`No mapping exists for ${key}`);
      }
      if (mapping.execution.desiredState === 'archived') {
        return { mapping, actions: ['already-archived'] } satisfies ReconcileResult;
      }

      try {
        await this.buzz.archiveChannel(mapping.buzz.channelId);
        const now = this.now().toISOString();
        mapping.execution.desiredState = 'archived';
        mapping.execution.observedState = 'archived';
        mapping.execution.archivedAt = now;
        mapping.execution.updatedAt = now;
        mapping.execution.lastError = null;
        await this.store.write(data);
        return { mapping, actions: ['archived-channel'] } satisfies ReconcileResult;
      } catch (error) {
        mapping.execution.observedState = 'error';
        mapping.execution.lastError = errorMessage(error);
        mapping.execution.updatedAt = this.now().toISOString();
        await this.store.write(data);
        throw error;
      }
    });
  }

  private async createOrAdoptMapping(request: ReconcileRequest, actions: string[]) {
    assertCreationRequest(request);
    const channels = await this.buzz.listChannels();
    const matches = channels.filter(x => x.name === request.channelName);
    if (matches.length > 1) {
      throw new Error(`Multiple visible Buzz channels are named ${request.channelName}`);
    }

    let channel;
    if (matches.length === 1) {
      if (request.adoptExisting !== true) {
        throw new Error(
          `Buzz channel ${request.channelName} already exists; rerun with --adopt-existing after verifying it`,
        );
      }
      channel = matches[0];
      actions.push('adopted-channel');
    } else {
      channel = await this.buzz.createChannel({
        name: request.channelName,
        description: request.channelDescription ?? `Linear ${request.key}: ${request.title}`,
        type: request.channelType ?? 'stream',
        visibility: request.channelVisibility ?? 'open',
      });
      actions.push('created-channel');
    }

    return createMapping(request, channel.channelId, this.now().toISOString());
  }

  private async ensureMembers(mapping: TaskMapping, actions: string[]) {
    const current = new Map(
      (await this.buzz.listMembers(mapping.buzz.channelId)).map(x => [x.pubkey, x.role]),
    );
    for (const member of mapping.buzz.members) {
      if (current.get(member.pubkey) === member.role) {
        continue;
      }
      await this.buzz.addMember(mapping.buzz.channelId, member);
      actions.push(`set-member:${member.pubkey}:${member.role}`);
    }
  }
}

function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : String(value);
}
