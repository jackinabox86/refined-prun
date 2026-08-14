export const STORE_SCHEMA_VERSION = 3;

export const MEMBER_ROLES = ['owner', 'admin', 'member', 'guest', 'bot'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const REVIEW_EVENT_KINDS = ['ready-for-review', 'review-activity'] as const;
export type ReviewEventKind = (typeof REVIEW_EVENT_KINDS)[number];

export const LINEAR_LIFECYCLE_STATES = [
  'todo',
  'in-progress',
  'in-review',
  'done',
  'other',
] as const;
export type LinearLifecycleState = (typeof LINEAR_LIFECYCLE_STATES)[number];

export const DELIVERY_OUTCOMES = ['pending', 'applied', 'ignored', 'failed'] as const;
export type DeliveryOutcome = (typeof DELIVERY_OUTCOMES)[number];

export const ATTENTION_SIGNAL_KINDS = ['progress', 'stall', 'recovery', 'handoff'] as const;
export type AttentionSignalKind = (typeof ATTENTION_SIGNAL_KINDS)[number];

export const ATTENTION_STATES = ['idle', 'healthy', 'attention', 'recovered'] as const;
export type AttentionStateName = (typeof ATTENTION_STATES)[number];

export const ATTENTION_DELIVERY_OUTCOMES = ['none', 'pending', 'applied', 'failed'] as const;
export type AttentionDeliveryOutcome = (typeof ATTENTION_DELIVERY_OUTCOMES)[number];

export interface DesiredMember {
  pubkey: string;
  role: MemberRole;
}

export interface LinearStatusIds {
  todo: string;
  inProgress: string;
  inReview: string;
  done: string;
}

export interface TeamLifecyclePolicy {
  inReview: {
    enabled: boolean;
    staleAfterSeconds: number;
    maxDeliveries: number;
  };
  updatedAt: string;
}

export interface AttentionPolicy {
  enabled: boolean;
  staleAfterSeconds: number;
  maxSignals: number;
  updatedAt: string;
}

export interface AttentionSignal {
  id: string;
  kind: AttentionSignalKind;
  observedAt: string;
  owner: string;
  nextOwner: string | null;
  reason: string | null;
}

export interface AttentionState {
  status: AttentionStateName;
  signals: AttentionSignal[];
  lastProgressAt: string | null;
  lastObservedAt: string | null;
  stallReason: string | null;
  label: {
    desired: boolean;
    observed: boolean | null;
    deliveryId: string | null;
    outcome: AttentionDeliveryOutcome;
    reason: string | null;
    updatedAt: string | null;
    attempts: number;
    lastError: string | null;
  };
}

export interface LifecycleDelivery {
  id: string;
  kind: ReviewEventKind;
  source: string;
  observedAt: string;
  updatedAt: string;
  outcome: DeliveryOutcome;
  reason: string;
  targetStatusId: string | null;
  attempts: number;
  lastError: string | null;
}

export interface LifecycleState {
  deliveries: LifecycleDelivery[];
  lastObservedAt: string | null;
  alert: {
    state: 'clear' | 'attention';
    reason: string | null;
    since: string | null;
    deliveryId: string | null;
  };
}

export interface ReconcileRequest {
  key: string;
  title?: string;
  linearUrl?: string;
  linearIssueId?: string | null;
  teamId?: string;
  statusIds?: LinearStatusIds;
  channelName?: string;
  channelDescription?: string;
  channelType?: 'stream' | 'forum';
  channelVisibility?: 'open' | 'private';
  members?: DesiredMember[];
  repository?: string;
  branch?: string;
  worktree?: string;
  owner?: string;
  adoptExisting?: boolean;
}

export interface TaskMapping {
  schemaVersion: 3;
  linear: {
    key: string;
    title: string;
    url: string;
    issueId: string | null;
    teamId: string;
    statusIds: LinearStatusIds;
  };
  buzz: {
    channelId: string;
    channelName: string;
    description: string;
    type: 'stream' | 'forum';
    visibility: 'open' | 'private';
    members: DesiredMember[];
  };
  git: {
    repository: string;
    branch: string;
    worktree: string;
  };
  execution: {
    owner: string;
    desiredState: 'active' | 'archived';
    observedState: 'provisioning' | 'active' | 'archived' | 'error';
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
    lastError: string | null;
  };
  lifecycle: LifecycleState;
  attention: AttentionState;
}

export interface MappingStoreData {
  schemaVersion: 3;
  teamPolicies: Record<string, TeamLifecyclePolicy>;
  attentionPolicies: Record<string, Record<string, AttentionPolicy>>;
  mappings: Record<string, TaskMapping>;
}

type CreationRequest = ReconcileRequest &
  Required<
    Pick<
      ReconcileRequest,
      | 'title'
      | 'linearUrl'
      | 'teamId'
      | 'statusIds'
      | 'channelName'
      | 'repository'
      | 'branch'
      | 'worktree'
      | 'owner'
    >
  >;

interface TaskMappingV2 extends Omit<TaskMapping, 'schemaVersion' | 'attention'> {
  schemaVersion: 2;
}

interface TaskMappingV1 extends Omit<TaskMappingV2, 'schemaVersion' | 'lifecycle'> {
  schemaVersion: 1;
}

export function emptyLifecycleState(): LifecycleState {
  return {
    deliveries: [],
    lastObservedAt: null,
    alert: { state: 'clear', reason: null, since: null, deliveryId: null },
  };
}

export function emptyAttentionState(): AttentionState {
  return {
    status: 'idle',
    signals: [],
    lastProgressAt: null,
    lastObservedAt: null,
    stallReason: null,
    label: {
      desired: false,
      observed: null,
      deliveryId: null,
      outcome: 'none',
      reason: null,
      updatedAt: null,
      attempts: 0,
      lastError: null,
    },
  };
}

export function emptyStore(): MappingStoreData {
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    teamPolicies: {},
    attentionPolicies: {},
    mappings: {},
  };
}

export function migrateStore(value: unknown) {
  if (!isRecord(value)) {
    throw new Error(`Unsupported mapping store schema; expected ${STORE_SCHEMA_VERSION}`);
  }
  if (value.schemaVersion === STORE_SCHEMA_VERSION) {
    assertValidStore(value);
    return value;
  }
  if ((value.schemaVersion !== 1 && value.schemaVersion !== 2) || !isRecord(value.mappings)) {
    throw new Error(`Unsupported mapping store schema; expected ${STORE_SCHEMA_VERSION}`);
  }

  const migrated = emptyStore();
  if (value.schemaVersion === 2) {
    if (!isRecord(value.teamPolicies)) {
      throw new Error('Schema-v2 mapping store must contain teamPolicies');
    }
    for (const [teamId, policy] of Object.entries(value.teamPolicies)) {
      if (teamId === '' || !isTeamLifecyclePolicy(policy)) {
        throw new Error(`Invalid team lifecycle policy: ${teamId}`);
      }
      migrated.teamPolicies[teamId] = policy;
    }
  }
  for (const [key, candidate] of Object.entries(value.mappings)) {
    const base =
      value.schemaVersion === 1 && isTaskMappingV1(candidate)
        ? { ...candidate, lifecycle: emptyLifecycleState() }
        : value.schemaVersion === 2 && isTaskMappingV2(candidate)
          ? candidate
          : undefined;
    if (base === undefined || base.linear.key !== key) {
      throw new Error(`Invalid mapping record: ${key}`);
    }
    migrated.mappings[key] = {
      ...base,
      schemaVersion: STORE_SCHEMA_VERSION,
      attention: emptyAttentionState(),
    };
  }
  assertValidStore(migrated);
  return migrated;
}

export function normalizeIssueKey(value: string) {
  const key = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]*-[1-9][0-9]*$/.test(key)) {
    throw new Error(`Invalid Linear issue key: ${value}`);
  }
  return key;
}

export function normalizePubkey(value: string) {
  const pubkey = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(pubkey)) {
    throw new Error(`Invalid Nostr pubkey: ${value}`);
  }
  return pubkey;
}

export function parseMemberRole(value: string): MemberRole {
  if (!MEMBER_ROLES.includes(value as MemberRole)) {
    throw new Error(`Invalid channel member role: ${value}`);
  }
  return value as MemberRole;
}

export function createMapping(
  request: ReconcileRequest,
  channelId: string,
  now: string,
): TaskMapping {
  assertCreationRequest(request);
  const key = normalizeIssueKey(request.key);
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    linear: {
      key,
      title: request.title,
      url: request.linearUrl,
      issueId: request.linearIssueId ?? null,
      teamId: request.teamId,
      statusIds: request.statusIds,
    },
    buzz: {
      channelId,
      channelName: request.channelName,
      description: request.channelDescription ?? `Linear ${key}: ${request.title}`,
      type: request.channelType ?? 'stream',
      visibility: request.channelVisibility ?? 'open',
      members: dedupeMembers(request.members ?? []),
    },
    git: {
      repository: request.repository,
      branch: request.branch,
      worktree: request.worktree,
    },
    execution: {
      owner: request.owner,
      desiredState: 'active',
      observedState: 'provisioning',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      lastError: null,
    },
    lifecycle: emptyLifecycleState(),
    attention: emptyAttentionState(),
  } satisfies TaskMapping;
}

export function assertCreationRequest(
  request: ReconcileRequest,
): asserts request is CreationRequest {
  normalizeIssueKey(request.key);
  const required = {
    title: request.title,
    linearUrl: request.linearUrl,
    teamId: request.teamId,
    statusIds: request.statusIds,
    channelName: request.channelName,
    repository: request.repository,
    branch: request.branch,
    worktree: request.worktree,
    owner: request.owner,
  };
  for (const [name, value] of Object.entries(required)) {
    if (value === undefined || value === '') {
      throw new Error(`--${toKebabCase(name)} is required when creating a mapping`);
    }
  }
}

export function assertRequestCompatible(mapping: TaskMapping, request: ReconcileRequest) {
  const comparisons: Array<[string, unknown, unknown]> = [
    ['title', request.title, mapping.linear.title],
    ['linear-url', request.linearUrl, mapping.linear.url],
    ['linear-issue-id', request.linearIssueId, mapping.linear.issueId],
    ['team-id', request.teamId, mapping.linear.teamId],
    ['channel-name', request.channelName, mapping.buzz.channelName],
    ['channel-description', request.channelDescription, mapping.buzz.description],
    ['channel-type', request.channelType, mapping.buzz.type],
    ['channel-visibility', request.channelVisibility, mapping.buzz.visibility],
    ['repo', request.repository, mapping.git.repository],
    ['branch', request.branch, mapping.git.branch],
    ['worktree', request.worktree, mapping.git.worktree],
    ['owner', request.owner, mapping.execution.owner],
  ];
  for (const [name, requested, stored] of comparisons) {
    if (requested !== undefined && requested !== stored) {
      throw new Error(`Stored mapping conflicts with --${name}`);
    }
  }
  if (request.statusIds !== undefined) {
    const names = Object.keys(request.statusIds) as Array<keyof LinearStatusIds>;
    for (const name of names) {
      if (request.statusIds[name] !== mapping.linear.statusIds[name]) {
        throw new Error(`Stored mapping conflicts with --status-${toKebabCase(name)}-id`);
      }
    }
  }
}

export function mergeDesiredMembers(mapping: TaskMapping, members: DesiredMember[] | undefined) {
  if (members === undefined) {
    return;
  }
  const merged = new Map(mapping.buzz.members.map(x => [x.pubkey, x]));
  for (const member of dedupeMembers(members)) {
    merged.set(member.pubkey, member);
  }
  mapping.buzz.members = [...merged.values()].sort((a, b) => a.pubkey.localeCompare(b.pubkey));
}

export function assertValidStore(value: unknown): asserts value is MappingStoreData {
  if (!isRecord(value) || value.schemaVersion !== STORE_SCHEMA_VERSION) {
    throw new Error(`Unsupported mapping store schema; expected ${STORE_SCHEMA_VERSION}`);
  }
  if (!isRecord(value.teamPolicies) || !isRecord(value.mappings)) {
    throw new Error('Mapping store must contain teamPolicies and mappings objects');
  }
  if (!isRecord(value.attentionPolicies)) {
    throw new Error('Mapping store must contain an attentionPolicies object');
  }
  for (const [teamId, policy] of Object.entries(value.teamPolicies)) {
    if (teamId === '' || !isTeamLifecyclePolicy(policy)) {
      throw new Error(`Invalid team lifecycle policy: ${teamId}`);
    }
  }
  for (const [teamId, repositoryPolicies] of Object.entries(value.attentionPolicies)) {
    if (teamId === '' || !isRecord(repositoryPolicies)) {
      throw new Error(`Invalid attention policy team: ${teamId}`);
    }
    for (const [repository, policy] of Object.entries(repositoryPolicies)) {
      if (repository === '' || !isAttentionPolicy(policy)) {
        throw new Error(`Invalid attention policy: ${teamId}/${repository}`);
      }
    }
  }

  const channelIds = new Set<string>();
  const issueIds = new Set<string>();
  for (const [key, candidate] of Object.entries(value.mappings)) {
    if (!isTaskMapping(candidate) || candidate.linear.key !== key) {
      throw new Error(`Invalid mapping record: ${key}`);
    }
    if (channelIds.has(candidate.buzz.channelId)) {
      throw new Error(`Duplicate Buzz channel mapping: ${candidate.buzz.channelId}`);
    }
    channelIds.add(candidate.buzz.channelId);
    if (candidate.linear.issueId !== null) {
      if (issueIds.has(candidate.linear.issueId)) {
        throw new Error(`Duplicate Linear issue UUID mapping: ${candidate.linear.issueId}`);
      }
      issueIds.add(candidate.linear.issueId);
    }
  }
}

export function renderCanvas(
  mapping: TaskMapping,
  teamPolicy?: TeamLifecyclePolicy,
  attentionPolicy?: AttentionPolicy,
) {
  const statusIds = mapping.linear.statusIds;
  const lastDelivery = mapping.lifecycle.deliveries.at(-1);
  const lastSignal = mapping.attention.signals.at(-1);
  return `# ${mapping.linear.key} - ${mapping.linear.title}

## Task truth

- Linear: <${mapping.linear.url}>
- Linear issue UUID: ${mapping.linear.issueId ?? 'unavailable through current adapter'}
- Team ID: \`${mapping.linear.teamId}\`
- Status IDs: Todo \`${statusIds.todo}\`; In Progress \`${statusIds.inProgress}\`; In Review \`${statusIds.inReview}\`; Done \`${statusIds.done}\`

## Execution truth

- Buzz channel UUID: \`${mapping.buzz.channelId}\`
- Current owner: \`${mapping.execution.owner}\`
- Desired state: \`${mapping.execution.desiredState}\`
- Observed state: \`${mapping.execution.observedState}\`
- Repository: <${mapping.git.repository}>
- Branch: \`${mapping.git.branch}\`
- Worktree: \`${mapping.git.worktree}\`

## Lifecycle projection

- In Review projection: \`${teamPolicy?.inReview.enabled === true ? 'enabled' : 'disabled'}\`
- Delivery ledger entries: \`${mapping.lifecycle.deliveries.length}\`
- Last delivery: ${lastDelivery === undefined ? 'none' : `\`${lastDelivery.id}\` (${lastDelivery.outcome}: ${lastDelivery.reason})`}
- Alert: \`${mapping.lifecycle.alert.state}\`${mapping.lifecycle.alert.reason === null ? '' : ` - ${mapping.lifecycle.alert.reason}`}

## Structured attention and heartbeat

- Attention policy: \`${attentionPolicy?.enabled === true ? 'enabled' : 'disabled'}\`${attentionPolicy === undefined ? '' : `; stale after ${attentionPolicy.staleAfterSeconds}s`}
- Heartbeat state: \`${mapping.attention.status}\`
- Last progress: ${mapping.attention.lastProgressAt ?? 'none'}
- Last signal: ${lastSignal === undefined ? 'none' : `\`${lastSignal.id}\` (${lastSignal.kind})`}
- Stall reason: ${mapping.attention.stallReason ?? 'none'}
- Linear \`needs-human\`: desired \`${mapping.attention.label.desired}\`; observed \`${mapping.attention.label.observed ?? 'unknown'}\`; delivery \`${mapping.attention.label.outcome}\`

## Recovery check

1. Read this canvas and the mapping store.
2. Verify \`git worktree list\` contains the recorded worktree and branch.
3. Verify \`HEAD\`, \`git status\`, and the current Linear lifecycle state before editing.
4. Reconcile lifecycle and \`needs-human\` truth before retrying a pending or failed delivery.
5. Verify the latest heartbeat is healthy before writing; handoffs transfer the same pointers and owner.

## Guardrails

- Never synchronize chat into Linear or GitHub.
- Reconcile creates or updates structured pointers; it never deletes.
- Lifecycle projection may move In Progress to In Review only; native merge-to-Done remains primary.
- Attention projection changes only the \`needs-human\` label and canvas, never lifecycle.
- Archive only after Linear is Done and lifecycle/attention delivery state is clear.
- Never remove the worktree or branch without clean-status and unique-commit checks.
`;
}

function dedupeMembers(members: DesiredMember[]) {
  const byPubkey = new Map<string, DesiredMember>();
  for (const member of members) {
    const pubkey = normalizePubkey(member.pubkey);
    byPubkey.set(pubkey, { pubkey, role: parseMemberRole(member.role) });
  }
  return [...byPubkey.values()].sort((a, b) => a.pubkey.localeCompare(b.pubkey));
}

function isTaskMapping(value: unknown): value is TaskMapping {
  return (
    isBaseTaskMapping(value, STORE_SCHEMA_VERSION) &&
    'lifecycle' in value &&
    isLifecycleState(value.lifecycle) &&
    'attention' in value &&
    isAttentionState(value.attention)
  );
}

function isTaskMappingV2(value: unknown): value is TaskMappingV2 {
  return isBaseTaskMapping(value, 2) && 'lifecycle' in value && isLifecycleState(value.lifecycle);
}

function isTaskMappingV1(value: unknown): value is TaskMappingV1 {
  return isBaseTaskMapping(value, 1);
}

function isBaseTaskMapping(
  value: unknown,
  schemaVersion: 1 | 2 | 3,
): value is TaskMapping | TaskMappingV1 | TaskMappingV2 {
  if (!isRecord(value) || value.schemaVersion !== schemaVersion) {
    return false;
  }
  if (
    !isRecord(value.linear) ||
    !isRecord(value.buzz) ||
    !isRecord(value.git) ||
    !isRecord(value.execution) ||
    !isRecord(value.linear.statusIds) ||
    !Array.isArray(value.buzz.members)
  ) {
    return false;
  }
  return (
    typeof value.linear.key === 'string' &&
    typeof value.linear.title === 'string' &&
    typeof value.linear.url === 'string' &&
    (value.linear.issueId === null || typeof value.linear.issueId === 'string') &&
    typeof value.linear.teamId === 'string' &&
    typeof value.linear.statusIds.todo === 'string' &&
    typeof value.linear.statusIds.inProgress === 'string' &&
    typeof value.linear.statusIds.inReview === 'string' &&
    typeof value.linear.statusIds.done === 'string' &&
    typeof value.buzz.channelId === 'string' &&
    typeof value.buzz.channelName === 'string' &&
    typeof value.buzz.description === 'string' &&
    (value.buzz.type === 'stream' || value.buzz.type === 'forum') &&
    (value.buzz.visibility === 'open' || value.buzz.visibility === 'private') &&
    value.buzz.members.every(isDesiredMember) &&
    typeof value.git.repository === 'string' &&
    typeof value.git.branch === 'string' &&
    typeof value.git.worktree === 'string' &&
    typeof value.execution.owner === 'string' &&
    (value.execution.desiredState === 'active' || value.execution.desiredState === 'archived') &&
    (value.execution.observedState === 'provisioning' ||
      value.execution.observedState === 'active' ||
      value.execution.observedState === 'archived' ||
      value.execution.observedState === 'error') &&
    typeof value.execution.createdAt === 'string' &&
    typeof value.execution.updatedAt === 'string' &&
    (value.execution.archivedAt === null || typeof value.execution.archivedAt === 'string') &&
    (value.execution.lastError === null || typeof value.execution.lastError === 'string')
  );
}

function isLifecycleState(value: unknown): value is LifecycleState {
  return (
    isRecord(value) &&
    Array.isArray(value.deliveries) &&
    value.deliveries.every(isLifecycleDelivery) &&
    (value.lastObservedAt === null || typeof value.lastObservedAt === 'string') &&
    isRecord(value.alert) &&
    (value.alert.state === 'clear' || value.alert.state === 'attention') &&
    (value.alert.reason === null || typeof value.alert.reason === 'string') &&
    (value.alert.since === null || typeof value.alert.since === 'string') &&
    (value.alert.deliveryId === null || typeof value.alert.deliveryId === 'string')
  );
}

function isLifecycleDelivery(value: unknown): value is LifecycleDelivery {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    REVIEW_EVENT_KINDS.includes(value.kind as ReviewEventKind) &&
    typeof value.source === 'string' &&
    typeof value.observedAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.outcome === 'string' &&
    DELIVERY_OUTCOMES.includes(value.outcome as DeliveryOutcome) &&
    typeof value.reason === 'string' &&
    (value.targetStatusId === null || typeof value.targetStatusId === 'string') &&
    typeof value.attempts === 'number' &&
    Number.isSafeInteger(value.attempts) &&
    value.attempts >= 0 &&
    (value.lastError === null || typeof value.lastError === 'string')
  );
}

function isTeamLifecyclePolicy(value: unknown): value is TeamLifecyclePolicy {
  return (
    isRecord(value) &&
    isRecord(value.inReview) &&
    typeof value.inReview.enabled === 'boolean' &&
    isPositiveInteger(value.inReview.staleAfterSeconds) &&
    isPositiveInteger(value.inReview.maxDeliveries) &&
    typeof value.updatedAt === 'string'
  );
}

function isAttentionPolicy(value: unknown): value is AttentionPolicy {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    isPositiveInteger(value.staleAfterSeconds) &&
    isPositiveInteger(value.maxSignals) &&
    typeof value.updatedAt === 'string'
  );
}

function isAttentionState(value: unknown): value is AttentionState {
  return (
    isRecord(value) &&
    typeof value.status === 'string' &&
    ATTENTION_STATES.includes(value.status as AttentionStateName) &&
    Array.isArray(value.signals) &&
    value.signals.every(isAttentionSignal) &&
    (value.lastProgressAt === null || typeof value.lastProgressAt === 'string') &&
    (value.lastObservedAt === null || typeof value.lastObservedAt === 'string') &&
    (value.stallReason === null || typeof value.stallReason === 'string') &&
    isRecord(value.label) &&
    typeof value.label.desired === 'boolean' &&
    (value.label.observed === null || typeof value.label.observed === 'boolean') &&
    (value.label.deliveryId === null || typeof value.label.deliveryId === 'string') &&
    typeof value.label.outcome === 'string' &&
    ATTENTION_DELIVERY_OUTCOMES.includes(value.label.outcome as AttentionDeliveryOutcome) &&
    (value.label.reason === null || typeof value.label.reason === 'string') &&
    (value.label.updatedAt === null || typeof value.label.updatedAt === 'string') &&
    typeof value.label.attempts === 'number' &&
    Number.isSafeInteger(value.label.attempts) &&
    value.label.attempts >= 0 &&
    (value.label.lastError === null || typeof value.label.lastError === 'string')
  );
}

function isAttentionSignal(value: unknown): value is AttentionSignal {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    ATTENTION_SIGNAL_KINDS.includes(value.kind as AttentionSignalKind) &&
    typeof value.observedAt === 'string' &&
    typeof value.owner === 'string' &&
    (value.nextOwner === null || typeof value.nextOwner === 'string') &&
    (value.reason === null || typeof value.reason === 'string')
  );
}

function isDesiredMember(value: unknown): value is DesiredMember {
  return (
    isRecord(value) &&
    typeof value.pubkey === 'string' &&
    /^[a-f0-9]{64}$/.test(value.pubkey) &&
    typeof value.role === 'string' &&
    MEMBER_ROLES.includes(value.role as MemberRole)
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toKebabCase(value: string) {
  return value.replaceAll(/[A-Z]/g, x => `-${x.toLowerCase()}`);
}
