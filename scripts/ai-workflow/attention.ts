import {
  ATTENTION_SIGNAL_KINDS,
  LINEAR_LIFECYCLE_STATES,
  normalizeIssueKey,
  type AttentionPolicy,
  type AttentionSignal,
  type AttentionSignalKind,
  type LinearLifecycleState,
  type TaskMapping,
} from './model.ts';
import { JsonMappingStore } from './store.ts';

export interface ConfigureAttentionRequest {
  issueKey: string;
  enabled: boolean;
  staleAfterSeconds: number;
  maxSignals: number;
}

export interface ObserveHeartbeatRequest {
  issueKey: string;
  eventId: string;
  kind: AttentionSignalKind;
  owner: string;
  observedAt?: string;
  reason?: string;
  nextOwner?: string;
}

export interface ReconcileAttentionRequest {
  issueKey: string;
  linearState: LinearLifecycleState;
  linearNeedsHuman: boolean;
  now?: string;
}

export interface AcknowledgeAttentionRequest {
  issueKey: string;
  deliveryId: string;
  result: 'applied' | 'failed';
  error?: string;
}

export interface SetLinearNeedsHumanAction {
  type: 'set-linear-needs-human';
  issueKey: string;
  deliveryId: string;
  enabled: boolean;
  reason: string;
}

export interface AttentionResult {
  mapping: TaskMapping;
  actions: Array<
    | SetLinearNeedsHumanAction
    | { type: 'none'; reason: string }
    | { type: 'needs-attention'; reason: string }
  >;
}

export class AttentionProjector {
  readonly store: JsonMappingStore;
  readonly now: () => Date;

  constructor(store: JsonMappingStore, now = () => new Date()) {
    this.store = store;
    this.now = now;
  }

  async configure(request: ConfigureAttentionRequest) {
    assertPositiveInteger(request.staleAfterSeconds, 'stale-after-seconds');
    assertPositiveInteger(request.maxSignals, 'max-signals');
    return await this.store.withLock(async () => {
      const data = await this.store.read();
      const mapping = requireMapping(data.mappings, request.issueKey);
      const now = this.now().toISOString();
      const desired: AttentionPolicy = {
        enabled: request.enabled,
        staleAfterSeconds: request.staleAfterSeconds,
        maxSignals: request.maxSignals,
        updatedAt: now,
      };
      const teamPolicies = (data.attentionPolicies[mapping.linear.teamId] ??= {});
      const current = teamPolicies[mapping.git.repository];
      const unchanged =
        current?.enabled === desired.enabled &&
        current.staleAfterSeconds === desired.staleAfterSeconds &&
        current.maxSignals === desired.maxSignals;
      if (unchanged) {
        return result(mapping, 'attention-policy-current');
      }
      teamPolicies[mapping.git.repository] = desired;
      await this.store.write(data);
      return result(
        mapping,
        request.enabled ? 'enabled-attention-policy' : 'disabled-attention-policy',
      );
    });
  }

  async observe(request: ObserveHeartbeatRequest) {
    assertEventId(request.eventId);
    assertSignalKind(request.kind);
    assertNonempty(request.owner, 'owner');
    const observedAt = request.observedAt ?? this.now().toISOString();
    assertTimestamp(observedAt, 'observed-at');
    validateSignalDetails(request);

    return await this.store.withLock(async () => {
      const data = await this.store.read();
      const mapping = requireMapping(data.mappings, request.issueKey);
      const policy = attentionPolicy(data.attentionPolicies, mapping);
      if (policy?.enabled !== true) {
        return result(mapping, 'attention-policy-disabled');
      }
      if (mapping.execution.desiredState === 'archived') {
        return result(mapping, 'channel-archived');
      }
      if (mapping.execution.owner !== request.owner) {
        throw new Error(
          `Heartbeat owner ${request.owner} does not match current owner ${mapping.execution.owner}`,
        );
      }

      const existing = mapping.attention.signals.find(x => x.id === request.eventId);
      if (existing !== undefined) {
        assertSameSignal(existing, request, observedAt);
        return result(mapping, 'duplicate-heartbeat');
      }

      while (mapping.attention.signals.length >= policy.maxSignals) {
        mapping.attention.signals.shift();
      }
      const signal = createSignal(request, observedAt);
      mapping.attention.signals.push(signal);
      mapping.attention.lastObservedAt = observedAt;
      mapping.execution.updatedAt = this.now().toISOString();

      let actions: AttentionResult['actions'] = [];
      if (signal.kind === 'stall') {
        mapping.attention.status = 'attention';
        mapping.attention.stallReason = signal.reason;
        actions = planLabel(
          mapping,
          true,
          signal.reason!,
          `attention:${signal.id}:set`,
          mapping.execution.updatedAt,
        );
      } else if (signal.kind === 'recovery') {
        mapping.attention.status = 'recovered';
        mapping.attention.stallReason = null;
        mapping.attention.lastProgressAt = observedAt;
        const required = mapping.lifecycle.alert.state === 'attention';
        actions = planLabel(
          mapping,
          required,
          required ? 'lifecycle-alert-remains' : (signal.reason ?? 'recovered'),
          `attention:${signal.id}:${required ? 'set' : 'clear'}`,
          mapping.execution.updatedAt,
        );
      } else if (signal.kind === 'handoff') {
        mapping.execution.owner = signal.nextOwner!;
        mapping.attention.lastProgressAt = observedAt;
        if (mapping.attention.status !== 'attention') {
          mapping.attention.status = 'healthy';
        }
      } else {
        mapping.attention.lastProgressAt = observedAt;
        if (mapping.attention.status !== 'attention') {
          mapping.attention.status = 'healthy';
        }
      }

      await this.store.write(data);
      return {
        mapping,
        actions:
          actions.length === 0 ? [{ type: 'none', reason: `${signal.kind}-recorded` }] : actions,
      } satisfies AttentionResult;
    });
  }

  async acknowledge(request: AcknowledgeAttentionRequest) {
    assertEventId(request.deliveryId);
    if (request.result === 'failed') {
      assertNonempty(request.error, 'error');
    }
    return await this.store.withLock(async () => {
      const data = await this.store.read();
      const mapping = requireMapping(data.mappings, request.issueKey);
      const label = mapping.attention.label;
      if (label.deliveryId !== request.deliveryId) {
        throw new Error(`No current attention delivery exists for ${request.deliveryId}`);
      }
      if (label.outcome === 'applied' && request.result === 'applied') {
        return result(mapping, 'attention-delivery-already-applied');
      }
      if (label.outcome === 'applied' && request.result === 'failed') {
        throw new Error(
          `Applied attention delivery cannot be changed to failed: ${request.deliveryId}`,
        );
      }

      label.updatedAt = this.now().toISOString();
      if (request.result === 'applied') {
        label.observed = label.desired;
        label.outcome = 'applied';
        label.lastError = null;
        await this.store.write(data);
        return result(mapping, 'acknowledged-attention-applied');
      }

      label.outcome = 'failed';
      label.lastError = request.error!;
      await this.store.write(data);
      return {
        mapping,
        actions: [
          { type: 'needs-attention', reason: `linear-label-write-failed: ${request.error!}` },
        ],
      } satisfies AttentionResult;
    });
  }

  async reconcile(request: ReconcileAttentionRequest) {
    assertLinearState(request.linearState);
    const now = request.now ?? this.now().toISOString();
    assertTimestamp(now, 'now');
    return await this.store.withLock(async () => {
      const data = await this.store.read();
      const mapping = requireMapping(data.mappings, request.issueKey);
      const policy = attentionPolicy(data.attentionPolicies, mapping);
      if (policy?.enabled !== true) {
        return result(mapping, 'attention-policy-disabled');
      }
      if (mapping.execution.desiredState === 'archived') {
        return result(mapping, 'channel-archived');
      }

      mapping.attention.lastObservedAt = now;
      const monitorsHeartbeat =
        request.linearState === 'in-progress' || request.linearState === 'in-review';
      if (
        monitorsHeartbeat &&
        mapping.attention.lastProgressAt !== null &&
        isStale(mapping.attention.lastProgressAt, now, policy.staleAfterSeconds)
      ) {
        mapping.attention.status = 'attention';
        mapping.attention.stallReason ??= 'heartbeat-stale';
      }

      const label = mapping.attention.label;
      label.observed = request.linearNeedsHuman;
      const required =
        mapping.attention.status === 'attention' || mapping.lifecycle.alert.state === 'attention';
      const reason = attentionReason(mapping);
      let actions: AttentionResult['actions'];

      if (label.desired !== required) {
        const deliveryId = required
          ? `heartbeat-stale:${mapping.attention.lastProgressAt ?? now}:set`
          : `attention-recovered:${mapping.attention.lastProgressAt ?? now}:clear`;
        actions = planLabel(mapping, required, reason, deliveryId, now);
      } else if (label.observed === label.desired) {
        if (label.outcome === 'pending' || label.outcome === 'failed') {
          label.outcome = 'applied';
          label.lastError = null;
          label.updatedAt = now;
          actions = [{ type: 'none', reason: 'inferred-attention-applied-from-linear-label' }];
        } else {
          actions = [{ type: 'none', reason: 'attention-current' }];
        }
      } else if (label.outcome === 'failed') {
        label.outcome = 'pending';
        label.attempts += 1;
        label.updatedAt = now;
        label.lastError = null;
        actions = [labelAction(mapping)];
      } else if (label.outcome === 'pending') {
        actions = [{ type: 'none', reason: 'attention-delivery-awaiting-ack' }];
      } else {
        actions = planLabel(
          mapping,
          required,
          reason,
          `attention-reconcile:${mapping.attention.lastProgressAt ?? now}:${required ? 'set' : 'clear'}`,
          now,
        );
      }

      mapping.execution.updatedAt = now;
      await this.store.write(data);
      return { mapping, actions } satisfies AttentionResult;
    });
  }
}

function createSignal(request: ObserveHeartbeatRequest, observedAt: string): AttentionSignal {
  return {
    id: request.eventId,
    kind: request.kind,
    observedAt,
    owner: request.owner,
    nextOwner: request.nextOwner ?? null,
    reason: request.reason ?? null,
  };
}

function planLabel(
  mapping: TaskMapping,
  desired: boolean,
  reason: string,
  deliveryId: string,
  now: string,
) {
  const label = mapping.attention.label;
  label.desired = desired;
  label.deliveryId = deliveryId;
  label.reason = reason;
  label.updatedAt = now;
  label.lastError = null;
  if (label.observed === desired) {
    label.outcome = 'applied';
    label.attempts = 0;
    return [
      { type: 'none', reason: 'linear-needs-human-already-current' },
    ] satisfies AttentionResult['actions'];
  }
  label.outcome = 'pending';
  label.attempts = 1;
  const actions: AttentionResult['actions'] = [labelAction(mapping)];
  if (desired) {
    actions.unshift({ type: 'needs-attention', reason });
  }
  return actions;
}

function labelAction(mapping: TaskMapping) {
  const label = mapping.attention.label;
  if (label.deliveryId === null || label.reason === null) {
    throw new Error('Attention label delivery is incomplete');
  }
  return {
    type: 'set-linear-needs-human',
    issueKey: mapping.linear.key,
    deliveryId: label.deliveryId,
    enabled: label.desired,
    reason: label.reason,
  } satisfies SetLinearNeedsHumanAction;
}

function attentionReason(mapping: TaskMapping) {
  if (mapping.attention.status === 'attention') {
    return mapping.attention.stallReason ?? 'heartbeat-stale';
  }
  if (mapping.lifecycle.alert.state === 'attention') {
    return mapping.lifecycle.alert.reason ?? 'lifecycle-delivery-alert';
  }
  return 'recovered';
}

function attentionPolicy(
  policies: Record<string, Record<string, AttentionPolicy>>,
  mapping: TaskMapping,
) {
  return policies[mapping.linear.teamId]?.[mapping.git.repository];
}

function requireMapping(mappings: Record<string, TaskMapping>, issueKey: string) {
  const key = normalizeIssueKey(issueKey);
  const mapping = mappings[key];
  if (mapping === undefined) {
    throw new Error(`No mapping exists for ${key}`);
  }
  return mapping;
}

function result(mapping: TaskMapping, reason: string): AttentionResult {
  return { mapping, actions: [{ type: 'none', reason }] };
}

function validateSignalDetails(request: ObserveHeartbeatRequest) {
  if (request.kind === 'stall') {
    assertNonempty(request.reason, 'reason');
  }
  if (request.kind === 'handoff') {
    assertNonempty(request.nextOwner, 'next-owner');
    if (request.nextOwner === request.owner) {
      throw new Error('--next-owner must differ from --owner');
    }
  } else if (request.nextOwner !== undefined) {
    throw new Error('--next-owner is valid only for a handoff heartbeat');
  }
  if (request.reason !== undefined && request.reason.length > 512) {
    throw new Error('--reason must be at most 512 characters');
  }
}

function assertSameSignal(
  signal: AttentionSignal,
  request: ObserveHeartbeatRequest,
  observedAt: string,
) {
  if (
    signal.kind !== request.kind ||
    signal.owner !== request.owner ||
    signal.observedAt !== observedAt ||
    signal.nextOwner !== (request.nextOwner ?? null) ||
    signal.reason !== (request.reason ?? null)
  ) {
    throw new Error(`Heartbeat identity conflicts with stored signal: ${request.eventId}`);
  }
}

function isStale(updatedAt: string, now: string, staleAfterSeconds: number) {
  return Date.parse(now) - Date.parse(updatedAt) >= staleAfterSeconds * 1_000;
}

function assertSignalKind(value: string): asserts value is AttentionSignalKind {
  if (!ATTENTION_SIGNAL_KINDS.includes(value as AttentionSignalKind)) {
    throw new Error(`Invalid --kind: ${value}`);
  }
}

function assertLinearState(value: string): asserts value is LinearLifecycleState {
  if (!LINEAR_LIFECYCLE_STATES.includes(value as LinearLifecycleState)) {
    throw new Error(`Invalid --linear-state: ${value}`);
  }
}

function assertEventId(value: string) {
  assertNonempty(value, 'event-id');
  if (value.length > 512) {
    throw new Error('--event-id must be at most 512 characters');
  }
}

function assertTimestamp(value: string, name: string) {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`--${name} must be an ISO-8601 timestamp`);
  }
}

function assertPositiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
}

function assertNonempty(value: string | undefined, name: string): asserts value is string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`--${name} is required`);
  }
}
