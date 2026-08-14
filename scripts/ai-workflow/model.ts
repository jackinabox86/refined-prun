export const STORE_SCHEMA_VERSION = 1;

export const MEMBER_ROLES = ['owner', 'admin', 'member', 'guest', 'bot'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

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
  schemaVersion: 1;
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
}

export interface MappingStoreData {
  schemaVersion: 1;
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

export function emptyStore(): MappingStoreData {
  return { schemaVersion: STORE_SCHEMA_VERSION, mappings: {} };
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

export function createMapping(request: ReconcileRequest, channelId: string, now: string) {
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
  if (!isRecord(value.mappings)) {
    throw new Error('Mapping store must contain a mappings object');
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

export function renderCanvas(mapping: TaskMapping) {
  const statusIds = mapping.linear.statusIds;
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

## Recovery check

1. Read this canvas and the mapping store.
2. Verify \`git worktree list\` contains the recorded worktree and branch.
3. Verify \`HEAD\`, \`git status\`, and the current Linear lifecycle state before editing.
4. Only the recorded owner writes in the worktree; handoffs transfer these same pointers.

## Guardrails

- Never synchronize chat into Linear or GitHub.
- Reconcile creates or updates structured pointers; it never deletes.
- Archive the channel only after completion is verified.
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
  if (!isRecord(value) || value.schemaVersion !== STORE_SCHEMA_VERSION) {
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

function isDesiredMember(value: unknown): value is DesiredMember {
  return (
    isRecord(value) &&
    typeof value.pubkey === 'string' &&
    /^[a-f0-9]{64}$/.test(value.pubkey) &&
    typeof value.role === 'string' &&
    MEMBER_ROLES.includes(value.role as MemberRole)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toKebabCase(value: string) {
  return value.replaceAll(/[A-Z]/g, x => `-${x.toLowerCase()}`);
}
