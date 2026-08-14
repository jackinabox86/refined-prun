import {
  LINEAR_LIFECYCLE_STATES,
  REVIEW_EVENT_KINDS,
  normalizeIssueKey,
  type LifecycleDelivery,
  type LinearLifecycleState,
  type ReviewEventKind,
  type TaskMapping,
  type TeamLifecyclePolicy,
} from './model.ts';
import { JsonMappingStore } from './store.ts';

export interface ObserveReviewEventRequest {
  issueKey: string;
  eventId: string;
  eventKind: ReviewEventKind;
  source: string;
  linearState: LinearLifecycleState;
  observedAt?: string;
}

export interface AcknowledgeDeliveryRequest {
  issueKey: string;
  eventId: string;
  result: 'applied' | 'failed';
  error?: string;
}

export interface ConfigureProjectionRequest {
  issueKey: string;
  enabled: boolean;
  staleAfterSeconds: number;
  maxDeliveries: number;
}

export interface ReconcileLifecycleRequest {
  issueKey: string;
  linearState: LinearLifecycleState;
  now?: string;
}

export interface SetLinearStatusAction {
  type: 'set-linear-status';
  issueKey: string;
  deliveryId: string;
  statusId: string;
  reason: string;
}

export interface LifecycleResult {
  mapping: TaskMapping;
  actions: Array<
    | SetLinearStatusAction
    | { type: 'none'; reason: string }
    | { type: 'needs-attention'; deliveryId: string | null; reason: string }
  >;
}

export class LifecycleProjector {
  readonly store: JsonMappingStore;
  readonly now: () => Date;

  constructor(store: JsonMappingStore, now = () => new Date()) {
    this.store = store;
    this.now = now;
  }

  async configure(request: ConfigureProjectionRequest) {
    assertPositiveInteger(request.staleAfterSeconds, 'stale-after-seconds');
    assertPositiveInteger(request.maxDeliveries, 'max-deliveries');
    return await this.store.withLock(async () => {
      const data = await this.store.read();
      const mapping = requireMapping(data.mappings, request.issueKey);
      const now = this.now().toISOString();
      const desired: TeamLifecyclePolicy = {
        inReview: {
          enabled: request.enabled,
          staleAfterSeconds: request.staleAfterSeconds,
          maxDeliveries: request.maxDeliveries,
        },
        updatedAt: now,
      };
      const current = data.teamPolicies[mapping.linear.teamId];
      const unchanged =
        current?.inReview.enabled === desired.inReview.enabled &&
        current.inReview.staleAfterSeconds === desired.inReview.staleAfterSeconds &&
        current.inReview.maxDeliveries === desired.inReview.maxDeliveries;
      if (unchanged) {
        return {
          mapping,
          actions: [{ type: 'none', reason: 'projection-current' }],
        } satisfies LifecycleResult;
      }
      data.teamPolicies[mapping.linear.teamId] = desired;
      await this.store.write(data);
      return {
        mapping,
        actions: [
          {
            type: 'none',
            reason: request.enabled
              ? 'enabled-in-review-projection'
              : 'disabled-in-review-projection',
          },
        ],
      } satisfies LifecycleResult;
    });
  }

  async observe(request: ObserveReviewEventRequest) {
    assertEventId(request.eventId);
    assertEventKind(request.eventKind);
    assertLinearState(request.linearState);
    assertNonempty(request.source, 'source');
    const observedAt = request.observedAt ?? this.now().toISOString();
    assertTimestamp(observedAt, 'observed-at');

    return await this.store.withLock(async () => {
      const data = await this.store.read();
      const mapping = requireMapping(data.mappings, request.issueKey);
      const policy = data.teamPolicies[mapping.linear.teamId];
      const now = this.now().toISOString();
      const existing = mapping.lifecycle.deliveries.find(x => x.id === request.eventId);
      if (existing !== undefined) {
        assertSameEvent(existing, request);
        const actions = handleExistingDelivery(mapping, existing, request.linearState, policy, now);
        mapping.lifecycle.lastObservedAt = observedAt;
        await this.store.write(data);
        return { mapping, actions } satisfies LifecycleResult;
      }

      ensureLedgerCapacity(mapping, policy);
      const delivery = createDelivery(request, observedAt, now, mapping, policy);
      mapping.lifecycle.deliveries.push(delivery);
      mapping.lifecycle.lastObservedAt = observedAt;
      const actions = initialActions(mapping, delivery);
      await this.store.write(data);
      return { mapping, actions } satisfies LifecycleResult;
    });
  }

  async acknowledge(request: AcknowledgeDeliveryRequest) {
    assertEventId(request.eventId);
    if (request.result === 'failed') {
      assertNonempty(request.error, 'error');
    }
    return await this.store.withLock(async () => {
      const data = await this.store.read();
      const mapping = requireMapping(data.mappings, request.issueKey);
      const delivery = mapping.lifecycle.deliveries.find(x => x.id === request.eventId);
      if (delivery === undefined) {
        throw new Error(`No lifecycle delivery exists for ${request.eventId}`);
      }
      if (delivery.outcome === 'ignored') {
        throw new Error(`Ignored delivery cannot be acknowledged: ${request.eventId}`);
      }
      if (delivery.outcome === 'applied' && request.result === 'applied') {
        return {
          mapping,
          actions: [{ type: 'none', reason: 'delivery-already-applied' }],
        } satisfies LifecycleResult;
      }
      if (delivery.outcome === 'applied' && request.result === 'failed') {
        throw new Error(`Applied delivery cannot be changed to failed: ${request.eventId}`);
      }

      const now = this.now().toISOString();
      delivery.updatedAt = now;
      if (request.result === 'applied') {
        delivery.outcome = 'applied';
        delivery.reason = 'acknowledged-applied';
        delivery.lastError = null;
        clearAlertFor(mapping, delivery.id);
      } else {
        delivery.outcome = 'failed';
        delivery.reason = 'linear-write-failed';
        delivery.lastError = request.error!;
        setAlert(mapping, delivery.id, `linear-write-failed: ${request.error!}`, now);
      }
      await this.store.write(data);
      const action: LifecycleResult['actions'][number] =
        request.result === 'applied'
          ? { type: 'none', reason: delivery.reason }
          : { type: 'needs-attention', deliveryId: delivery.id, reason: delivery.reason };
      return {
        mapping,
        actions: [action],
      } satisfies LifecycleResult;
    });
  }

  async reconcile(request: ReconcileLifecycleRequest) {
    assertLinearState(request.linearState);
    const now = request.now ?? this.now().toISOString();
    assertTimestamp(now, 'now');
    return await this.store.withLock(async () => {
      const data = await this.store.read();
      const mapping = requireMapping(data.mappings, request.issueKey);
      const policy = data.teamPolicies[mapping.linear.teamId];
      if (policy?.inReview.enabled !== true) {
        return {
          mapping,
          actions: [{ type: 'none', reason: 'projection-disabled' }],
        } satisfies LifecycleResult;
      }

      const unresolved = mapping.lifecycle.deliveries.filter(
        x => x.outcome === 'pending' || x.outcome === 'failed',
      );
      if (request.linearState === 'done') {
        for (const delivery of unresolved) {
          markIgnored(delivery, 'linear-terminal-done', now);
        }
        clearAlert(mapping);
        await this.store.write(data);
        return {
          mapping,
          actions: [{ type: 'none', reason: 'linear-terminal-done' }],
        } satisfies LifecycleResult;
      }
      if (request.linearState === 'in-review') {
        for (const delivery of unresolved) {
          delivery.outcome = 'applied';
          delivery.reason = 'inferred-applied-from-linear-state';
          delivery.updatedAt = now;
          delivery.lastError = null;
        }
        clearAlert(mapping);
        await this.store.write(data);
        return {
          mapping,
          actions: [{ type: 'none', reason: 'inferred-applied-from-linear-state' }],
        } satisfies LifecycleResult;
      }
      if (request.linearState !== 'in-progress') {
        const deliveryId = unresolved[0]?.id ?? null;
        setAlert(mapping, deliveryId, `unexpected-linear-state:${request.linearState}`, now);
        await this.store.write(data);
        return {
          mapping,
          actions: [
            {
              type: 'needs-attention',
              deliveryId,
              reason: `unexpected-linear-state:${request.linearState}`,
            },
          ],
        } satisfies LifecycleResult;
      }

      const retry = unresolved.find(
        x => x.outcome === 'failed' || isStale(x.updatedAt, now, policy.inReview.staleAfterSeconds),
      );
      if (retry !== undefined) {
        retry.outcome = 'pending';
        retry.reason = retry.lastError === null ? 'retry-stale-delivery' : 'retry-failed-delivery';
        retry.updatedAt = now;
        retry.attempts += 1;
        retry.lastError = null;
        setAlert(mapping, retry.id, retry.reason, now);
        await this.store.write(data);
        return {
          mapping,
          actions: [
            { type: 'needs-attention', deliveryId: retry.id, reason: retry.reason },
            statusAction(mapping, retry, retry.reason),
          ],
        } satisfies LifecycleResult;
      }

      if (unresolved.length > 0) {
        clearAlert(mapping);
        await this.store.write(data);
        return {
          mapping,
          actions: [{ type: 'none', reason: 'delivery-awaiting-ack' }],
        } satisfies LifecycleResult;
      }

      const applied = mapping.lifecycle.deliveries.findLast(x => x.outcome === 'applied');
      if (applied !== undefined) {
        setAlert(mapping, applied.id, 'linear-state-regressed-after-applied-delivery', now);
        await this.store.write(data);
        return {
          mapping,
          actions: [
            {
              type: 'needs-attention',
              deliveryId: applied.id,
              reason: 'linear-state-regressed-after-applied-delivery',
            },
          ],
        } satisfies LifecycleResult;
      }

      clearAlert(mapping);
      await this.store.write(data);
      return {
        mapping,
        actions: [{ type: 'none', reason: 'no-review-delivery' }],
      } satisfies LifecycleResult;
    });
  }
}

function createDelivery(
  request: ObserveReviewEventRequest,
  observedAt: string,
  now: string,
  mapping: TaskMapping,
  policy: TeamLifecyclePolicy | undefined,
): LifecycleDelivery {
  const delivery: LifecycleDelivery = {
    id: request.eventId,
    kind: request.eventKind,
    source: request.source,
    observedAt,
    updatedAt: now,
    outcome: 'ignored',
    reason: 'projection-disabled',
    targetStatusId: null,
    attempts: 0,
    lastError: null,
  };
  if (policy?.inReview.enabled !== true) {
    return delivery;
  }
  if (mapping.execution.desiredState === 'archived') {
    delivery.reason = 'channel-archived';
    return delivery;
  }
  if (request.linearState === 'done') {
    delivery.reason = 'linear-terminal-done';
    return delivery;
  }
  if (request.linearState === 'in-review') {
    delivery.reason = 'linear-already-in-review';
    return delivery;
  }
  if (request.linearState !== 'in-progress') {
    delivery.reason = `ineligible-linear-state:${request.linearState}`;
    return delivery;
  }
  delivery.outcome = 'pending';
  delivery.reason = 'eligible-review-event';
  delivery.targetStatusId = mapping.linear.statusIds.inReview;
  delivery.attempts = 1;
  return delivery;
}

function initialActions(mapping: TaskMapping, delivery: LifecycleDelivery) {
  if (delivery.outcome !== 'pending') {
    return [{ type: 'none', reason: delivery.reason }] satisfies LifecycleResult['actions'];
  }
  return [statusAction(mapping, delivery, delivery.reason)] satisfies LifecycleResult['actions'];
}

function handleExistingDelivery(
  mapping: TaskMapping,
  delivery: LifecycleDelivery,
  linearState: LinearLifecycleState,
  policy: TeamLifecyclePolicy | undefined,
  now: string,
): LifecycleResult['actions'] {
  if (linearState === 'done') {
    if (delivery.outcome === 'pending' || delivery.outcome === 'failed') {
      markIgnored(delivery, 'linear-terminal-done', now);
      clearAlertFor(mapping, delivery.id);
    }
    return [{ type: 'none', reason: 'duplicate-event-linear-terminal-done' }];
  }
  if (linearState === 'in-review') {
    if (delivery.outcome === 'pending' || delivery.outcome === 'failed') {
      delivery.outcome = 'applied';
      delivery.reason = 'inferred-applied-from-linear-state';
      delivery.updatedAt = now;
      delivery.lastError = null;
      clearAlertFor(mapping, delivery.id);
    }
    return [{ type: 'none', reason: 'duplicate-event-linear-in-review' }];
  }
  if (delivery.outcome === 'applied' || delivery.outcome === 'ignored') {
    return [{ type: 'none', reason: `duplicate-event-${delivery.outcome}` }];
  }
  if (policy?.inReview.enabled !== true) {
    return [{ type: 'none', reason: 'projection-disabled' }];
  }
  if (linearState !== 'in-progress') {
    return [{ type: 'none', reason: `duplicate-event-ineligible-state:${linearState}` }];
  }
  if (
    delivery.outcome === 'pending' &&
    !isStale(delivery.updatedAt, now, policy.inReview.staleAfterSeconds)
  ) {
    return [{ type: 'none', reason: 'duplicate-event-awaiting-ack' }];
  }

  delivery.outcome = 'pending';
  delivery.reason = delivery.lastError === null ? 'retry-stale-delivery' : 'retry-failed-delivery';
  delivery.updatedAt = now;
  delivery.attempts += 1;
  delivery.lastError = null;
  setAlert(mapping, delivery.id, delivery.reason, now);
  return [statusAction(mapping, delivery, delivery.reason)];
}

function statusAction(mapping: TaskMapping, delivery: LifecycleDelivery, reason: string) {
  if (delivery.targetStatusId === null) {
    throw new Error(`Delivery ${delivery.id} has no target status`);
  }
  return {
    type: 'set-linear-status',
    issueKey: mapping.linear.key,
    deliveryId: delivery.id,
    statusId: delivery.targetStatusId,
    reason,
  } satisfies SetLinearStatusAction;
}

function ensureLedgerCapacity(mapping: TaskMapping, policy: TeamLifecyclePolicy | undefined) {
  const maxDeliveries = policy?.inReview.maxDeliveries ?? 100;
  while (mapping.lifecycle.deliveries.length >= maxDeliveries) {
    const index = mapping.lifecycle.deliveries.findIndex(
      x => x.outcome === 'applied' || x.outcome === 'ignored',
    );
    if (index === -1) {
      throw new Error(`Lifecycle delivery ledger is full of unresolved entries (${maxDeliveries})`);
    }
    mapping.lifecycle.deliveries.splice(index, 1);
  }
}

function requireMapping(mappings: Record<string, TaskMapping>, issueKey: string) {
  const key = normalizeIssueKey(issueKey);
  const mapping = mappings[key];
  if (mapping === undefined) {
    throw new Error(`No mapping exists for ${key}`);
  }
  return mapping;
}

function assertSameEvent(delivery: LifecycleDelivery, request: ObserveReviewEventRequest) {
  if (delivery.kind !== request.eventKind || delivery.source !== request.source) {
    throw new Error(`Lifecycle delivery identity conflicts with stored event: ${request.eventId}`);
  }
}

function markIgnored(delivery: LifecycleDelivery, reason: string, now: string) {
  delivery.outcome = 'ignored';
  delivery.reason = reason;
  delivery.updatedAt = now;
  delivery.lastError = null;
}

function setAlert(mapping: TaskMapping, deliveryId: string | null, reason: string, now: string) {
  mapping.lifecycle.alert = {
    state: 'attention',
    reason,
    since:
      mapping.lifecycle.alert.state === 'attention' && mapping.lifecycle.alert.reason === reason
        ? (mapping.lifecycle.alert.since ?? now)
        : now,
    deliveryId,
  };
}

function clearAlertFor(mapping: TaskMapping, deliveryId: string) {
  if (mapping.lifecycle.alert.deliveryId === deliveryId) {
    clearAlert(mapping);
  }
}

function clearAlert(mapping: TaskMapping) {
  mapping.lifecycle.alert = { state: 'clear', reason: null, since: null, deliveryId: null };
}

function isStale(updatedAt: string, now: string, staleAfterSeconds: number) {
  return Date.parse(now) - Date.parse(updatedAt) >= staleAfterSeconds * 1_000;
}

function assertEventId(value: string) {
  assertNonempty(value, 'event-id');
  if (value.length > 512) {
    throw new Error('--event-id must be at most 512 characters');
  }
}

function assertEventKind(value: string): asserts value is ReviewEventKind {
  if (!REVIEW_EVENT_KINDS.includes(value as ReviewEventKind)) {
    throw new Error(`Invalid --event-kind: ${value}`);
  }
}

function assertLinearState(value: string): asserts value is LinearLifecycleState {
  if (!LINEAR_LIFECYCLE_STATES.includes(value as LinearLifecycleState)) {
    throw new Error(`Invalid --linear-state: ${value}`);
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
