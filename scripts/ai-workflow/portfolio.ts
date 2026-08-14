import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, posix, win32 } from 'node:path';
import {
  LINEAR_LIFECYCLE_STATES,
  REPOSITORY_ARCHIVE_POLICIES,
  REPOSITORY_LINK_ROLES,
  REPOSITORY_PROVIDERS,
  normalizeIssueKey,
  type LinearLifecycleState,
  type PortfolioFinding,
  type PortfolioRepositoryLink,
  type RepositoryArchivePolicy,
  type RepositoryLinkRole,
  type RepositoryProvider,
  type RepositoryRegistration,
  type TaskMapping,
} from './model.ts';
import { JsonMappingStore } from './store.ts';

const MAX_PORTFOLIO_AUDITS = 100;

export interface RegisterRepositoryRequest {
  issueKey: string;
  provider: RepositoryProvider;
  providerRepositoryId: string;
  owner: string;
  name: string;
  remoteUrl: string;
  defaultBranch: string;
  localCheckout: string;
  worktreeRoot: string;
  archivePolicy: RepositoryArchivePolicy;
  replaceMetadata: boolean;
}

export interface LinkRepositoryRequest {
  issueKey: string;
  repositoryId: string;
  role: RepositoryLinkRole;
  branch?: string;
  worktree?: string;
  pullRequestUrl?: string;
  replaceArtifacts: boolean;
}

export interface PortfolioObservation {
  eventId: string;
  observedAt: string;
  linear: { key: string; state: LinearLifecycleState };
  buzz: { channelId: string; state: 'active' | 'archived' | 'missing' };
  repositories: RepositoryObservation[];
}

interface RepositoryObservation {
  repositoryId: string;
  state: 'present' | 'missing';
  providerRepositoryId: string;
  owner: string;
  name: string;
  remoteUrl: string;
  defaultBranch: string;
  localCheckout: string;
  localCheckoutPresent: boolean;
  branches: string[];
  worktrees: Array<{ path: string; branch: string }>;
  pullRequestUrls: string[];
}

export type PortfolioAction =
  | { type: 'none'; reason: string }
  | {
      type: 'needs-attention';
      issueKey: string;
      eventId: string;
      findings: PortfolioFinding[];
    };

export class PortfolioReconciler {
  readonly store: JsonMappingStore;
  readonly now: () => Date;

  constructor(store: JsonMappingStore, now = () => new Date()) {
    this.store = store;
    this.now = now;
  }

  async register(request: RegisterRepositoryRequest) {
    validateRegistrationRequest(request);
    return await this.store.withLock(async () => {
      const data = await this.store.read();
      const mapping = requireMapping(data.mappings, request.issueKey);
      const id = repositoryId(request.provider, request.providerRepositoryId);
      const desired = registration(request, id, this.now().toISOString());
      const current = data.repositories[id];
      if (current !== undefined && sameRegistration(current, desired)) {
        return {
          mapping,
          repository: current,
          actions: [{ type: 'none', reason: 'repository-registration-current' }],
        };
      }
      if (current !== undefined && !request.replaceMetadata) {
        throw new Error(
          `Repository ${id} metadata conflicts with the allowlist; use --replace-metadata after review`,
        );
      }
      data.repositories[id] = desired;
      await this.store.write(data);
      return {
        mapping,
        repository: desired,
        actions: [
          {
            type: 'none',
            reason:
              current === undefined ? 'registered-repository' : 'replaced-repository-metadata',
          },
        ],
      };
    });
  }

  async link(request: LinkRepositoryRequest) {
    validateLinkRequest(request);
    return await this.store.withLock(async () => {
      const data = await this.store.read();
      const mapping = requireMapping(data.mappings, request.issueKey);
      const repository = data.repositories[request.repositoryId];
      if (repository === undefined) {
        throw new Error(`Repository is not registered: ${request.repositoryId}`);
      }
      const desired: PortfolioRepositoryLink = {
        repositoryId: request.repositoryId,
        role: request.role,
        branch: request.branch ?? null,
        worktree: request.worktree === undefined ? null : canonicalPath(request.worktree),
        pullRequestUrl:
          request.pullRequestUrl === undefined ? null : canonicalRemote(request.pullRequestUrl),
      };
      validatePrimaryLink(mapping, repository, desired);
      const existingIndex = mapping.portfolio.repositories.findIndex(
        x => x.repositoryId === request.repositoryId,
      );
      const existing = mapping.portfolio.repositories[existingIndex];
      if (existing !== undefined && sameLink(existing, desired)) {
        return {
          mapping,
          actions: [{ type: 'none', reason: 'repository-link-current' }],
        };
      }
      if (existing !== undefined && !request.replaceArtifacts) {
        throw new Error(
          `Repository link ${request.repositoryId} conflicts; use --replace-artifacts after review`,
        );
      }
      if (
        desired.role === 'primary' &&
        mapping.portfolio.repositories.some(
          (x, index) => x.role === 'primary' && index !== existingIndex,
        )
      ) {
        throw new Error(`Mapping ${mapping.linear.key} already has a primary repository link`);
      }
      if (existingIndex === -1) {
        mapping.portfolio.repositories.push(desired);
      } else {
        mapping.portfolio.repositories[existingIndex] = desired;
      }
      mapping.portfolio.repositories.sort((a, b) => a.repositoryId.localeCompare(b.repositoryId));
      await this.store.write(data);
      return {
        mapping,
        actions: [
          {
            type: 'none',
            reason: existing === undefined ? 'linked-repository' : 'replaced-repository-link',
          },
        ],
      };
    });
  }

  async auditFile(issueKey: string, observationFile: string) {
    if (!isAbsolute(observationFile)) {
      throw new Error('--observation-file must be an absolute path');
    }
    const parsed: unknown = JSON.parse(await readFile(observationFile, 'utf8'));
    return await this.audit(issueKey, parseObservation(parsed));
  }

  async audit(issueKey: string, observation: PortfolioObservation) {
    validateObservation(observation);
    const normalizedObservation = normalizeObservation(observation);
    const observationHash = hashObservation(normalizedObservation);
    return await this.store.withLock(async () => {
      const data = await this.store.read();
      const mapping = requireMapping(data.mappings, issueKey);
      const existing = mapping.portfolio.audits.find(x => x.eventId === observation.eventId);
      if (existing !== undefined) {
        if (existing.observationHash !== observationHash) {
          throw new Error(`Portfolio event identity conflicts: ${observation.eventId}`);
        }
        return {
          mapping,
          actions: [{ type: 'none', reason: 'portfolio-observation-replayed' }],
        };
      }

      const findings = evaluate(mapping, data.repositories, normalizedObservation);
      mapping.portfolio.audits.push({
        eventId: normalizedObservation.eventId,
        observationHash,
        observedAt: normalizedObservation.observedAt,
        outcome: findings.length === 0 ? 'clear' : 'attention',
        findings,
      });
      while (mapping.portfolio.audits.length > MAX_PORTFOLIO_AUDITS) {
        mapping.portfolio.audits.shift();
      }

      const wasAttention = mapping.portfolio.alert.state === 'attention';
      let actions: PortfolioAction[];
      if (findings.length === 0) {
        mapping.portfolio.alert = {
          state: 'clear',
          reason: null,
          since: null,
          eventId: null,
          findings: [],
        };
        actions = [
          {
            type: 'none',
            reason: wasAttention ? 'portfolio-alert-cleared' : 'portfolio-current',
          },
        ];
      } else {
        mapping.portfolio.alert = {
          state: 'attention',
          reason: `portfolio-drift:${findings.map(x => x.code).join(',')}`,
          since: wasAttention
            ? (mapping.portfolio.alert.since ?? normalizedObservation.observedAt)
            : normalizedObservation.observedAt,
          eventId: normalizedObservation.eventId,
          findings,
        };
        actions = wasAttention
          ? [{ type: 'none', reason: 'portfolio-alert-current' }]
          : [
              {
                type: 'needs-attention',
                issueKey: mapping.linear.key,
                eventId: normalizedObservation.eventId,
                findings,
              },
            ];
      }
      await this.store.write(data);
      return { mapping, actions };
    });
  }
}

function evaluate(
  mapping: TaskMapping,
  registrations: Record<string, RepositoryRegistration>,
  observation: PortfolioObservation,
) {
  const findings: PortfolioFinding[] = [];
  const add = (
    code: string,
    repositoryId: string | null,
    expected: string | null,
    observed: string | null,
  ) => findings.push({ code, repositoryId, expected, observed });

  if (normalizeIssueKey(observation.linear.key) !== mapping.linear.key) {
    add('linear-key-mismatch', null, mapping.linear.key, observation.linear.key);
  }
  if (mapping.execution.desiredState === 'archived' && observation.linear.state !== 'done') {
    add('archived-mapping-linear-not-done', null, 'done', observation.linear.state);
  }
  if (observation.buzz.channelId !== mapping.buzz.channelId) {
    add('buzz-channel-mismatch', null, mapping.buzz.channelId, observation.buzz.channelId);
  }
  const expectedBuzzState = mapping.execution.desiredState === 'archived' ? 'archived' : 'active';
  if (observation.buzz.state !== expectedBuzzState) {
    add('buzz-state-mismatch', null, expectedBuzzState, observation.buzz.state);
  }

  const observedRepositories = new Map(observation.repositories.map(x => [x.repositoryId, x]));
  for (const observed of observation.repositories) {
    if (registrations[observed.repositoryId] === undefined) {
      throw new Error(`Observation contains an unregistered repository: ${observed.repositoryId}`);
    }
  }
  for (const link of mapping.portfolio.repositories) {
    const registration = registrations[link.repositoryId];
    if (registration === undefined) {
      add('repository-registration-missing', link.repositoryId, 'registered', 'missing');
      continue;
    }
    const observed = observedRepositories.get(link.repositoryId);
    if (observed === undefined) {
      add('linked-repository-not-observed', link.repositoryId, 'observed', 'missing');
      continue;
    }
    if (observed.state === 'missing') {
      add('linked-repository-missing', link.repositoryId, 'present', 'missing');
      continue;
    }
    compare(
      add,
      'provider-repository-id-mismatch',
      link.repositoryId,
      registration.providerRepositoryId,
      observed.providerRepositoryId,
    );
    compareFolded(
      add,
      'repository-owner-mismatch',
      link.repositoryId,
      registration.owner,
      observed.owner,
    );
    compareFolded(
      add,
      'repository-name-mismatch',
      link.repositoryId,
      registration.name,
      observed.name,
    );
    compareRemote(
      add,
      'repository-remote-mismatch',
      link.repositoryId,
      registration.remoteUrl,
      observed.remoteUrl,
    );
    compare(
      add,
      'default-branch-mismatch',
      link.repositoryId,
      registration.defaultBranch,
      observed.defaultBranch,
    );
    comparePath(
      add,
      'local-checkout-mismatch',
      link.repositoryId,
      registration.localCheckout,
      observed.localCheckout,
    );
    if (!observed.localCheckoutPresent) {
      add('local-checkout-missing', link.repositoryId, registration.localCheckout, 'missing');
    }
    if (link.branch !== null && !observed.branches.includes(link.branch)) {
      add('linked-branch-missing', link.repositoryId, link.branch, 'missing');
    }
    if (
      link.worktree !== null &&
      !observed.worktrees.some(
        x => samePath(x.path, link.worktree!) && (link.branch === null || x.branch === link.branch),
      )
    ) {
      add('linked-worktree-missing', link.repositoryId, link.worktree, 'missing');
    }
    if (
      link.pullRequestUrl !== null &&
      !observed.pullRequestUrls.some(x => sameRemote(x, link.pullRequestUrl!))
    ) {
      add('linked-pull-request-missing', link.repositoryId, link.pullRequestUrl, 'missing');
    }
  }
  return findings.sort((a, b) =>
    [a.repositoryId ?? '', a.code, a.expected ?? '', a.observed ?? '']
      .join('\0')
      .localeCompare([b.repositoryId ?? '', b.code, b.expected ?? '', b.observed ?? ''].join('\0')),
  );
}

function compare(
  add: (code: string, repositoryId: string, expected: string, observed: string) => void,
  code: string,
  repositoryId: string,
  expected: string,
  observed: string,
) {
  if (expected !== observed) {
    add(code, repositoryId, expected, observed);
  }
}

function compareFolded(
  add: (code: string, repositoryId: string, expected: string, observed: string) => void,
  code: string,
  repositoryId: string,
  expected: string,
  observed: string,
) {
  if (expected.toLowerCase() !== observed.toLowerCase()) {
    add(code, repositoryId, expected, observed);
  }
}

function compareRemote(
  add: (code: string, repositoryId: string, expected: string, observed: string) => void,
  code: string,
  repositoryId: string,
  expected: string,
  observed: string,
) {
  if (!sameRemote(expected, observed)) {
    add(code, repositoryId, expected, observed);
  }
}

function comparePath(
  add: (code: string, repositoryId: string, expected: string, observed: string) => void,
  code: string,
  repositoryId: string,
  expected: string,
  observed: string,
) {
  if (!samePath(expected, observed)) {
    add(code, repositoryId, expected, observed);
  }
}

function registration(request: RegisterRepositoryRequest, id: string, updatedAt: string) {
  return {
    id,
    provider: request.provider,
    providerRepositoryId: request.providerRepositoryId,
    owner: request.owner,
    name: request.name,
    remoteUrl: canonicalRemote(request.remoteUrl),
    defaultBranch: request.defaultBranch,
    localCheckout: canonicalPath(request.localCheckout),
    worktreeRoot: canonicalPath(request.worktreeRoot),
    archivePolicy: request.archivePolicy,
    updatedAt,
  } satisfies RepositoryRegistration;
}

function validateRegistrationRequest(request: RegisterRepositoryRequest) {
  if (!REPOSITORY_PROVIDERS.includes(request.provider)) {
    throw new Error(`Unsupported repository provider: ${request.provider}`);
  }
  for (const [name, value] of Object.entries({
    'provider-id': request.providerRepositoryId,
    owner: request.owner,
    name: request.name,
    'remote-url': request.remoteUrl,
    'default-branch': request.defaultBranch,
    'local-checkout': request.localCheckout,
    'worktree-root': request.worktreeRoot,
  })) {
    assertNonempty(value, name);
  }
  if (!REPOSITORY_ARCHIVE_POLICIES.includes(request.archivePolicy)) {
    throw new Error(`Unsupported archive policy: ${request.archivePolicy}`);
  }
  const remote = new URL(canonicalRemote(request.remoteUrl));
  const expectedPath = `/${request.owner}/${request.name}`.toLowerCase();
  if (
    remote.hostname.toLowerCase() !== 'github.com' ||
    remote.pathname.toLowerCase() !== expectedPath ||
    remote.username !== '' ||
    remote.password !== '' ||
    remote.search !== '' ||
    remote.hash !== ''
  ) {
    throw new Error('GitHub repository URL must match --repository-owner and --repository-name');
  }
  canonicalPath(request.localCheckout);
  canonicalPath(request.worktreeRoot);
}

function validateLinkRequest(request: LinkRepositoryRequest) {
  assertNonempty(request.repositoryId, 'repository-id');
  if (!REPOSITORY_LINK_ROLES.includes(request.role)) {
    throw new Error(`Unsupported repository role: ${request.role}`);
  }
  if (request.worktree !== undefined) {
    canonicalPath(request.worktree);
  }
  if (request.pullRequestUrl !== undefined) {
    canonicalRemote(request.pullRequestUrl);
  }
}

function validatePrimaryLink(
  mapping: TaskMapping,
  repository: RepositoryRegistration,
  link: PortfolioRepositoryLink,
) {
  if (link.role !== 'primary') {
    return;
  }
  if (!sameRemote(repository.remoteUrl, mapping.git.repository)) {
    throw new Error('Primary repository registration must match the mapping repository');
  }
  if (
    link.branch !== mapping.git.branch ||
    link.worktree === null ||
    !samePath(link.worktree, mapping.git.worktree)
  ) {
    throw new Error('Primary repository link must retain the mapping branch and worktree');
  }
}

function validateObservation(value: PortfolioObservation) {
  assertNonempty(value.eventId, 'event-id');
  if (value.eventId.length > 512) {
    throw new Error('--event-id must be at most 512 characters');
  }
  if (!Number.isFinite(Date.parse(value.observedAt))) {
    throw new Error('observedAt must be an ISO-8601 timestamp');
  }
  normalizeIssueKey(value.linear.key);
  if (!LINEAR_LIFECYCLE_STATES.includes(value.linear.state)) {
    throw new Error(`Invalid Linear state: ${value.linear.state}`);
  }
  const repositoryIds = new Set<string>();
  for (const repository of value.repositories) {
    if (repositoryIds.has(repository.repositoryId)) {
      throw new Error(`Duplicate repository observation: ${repository.repositoryId}`);
    }
    repositoryIds.add(repository.repositoryId);
  }
}

function parseObservation(value: unknown): PortfolioObservation {
  if (!isRecord(value) || !isRecord(value.linear) || !isRecord(value.buzz)) {
    throw new Error(
      'Observation file must contain eventId, observedAt, linear, buzz, and repositories',
    );
  }
  if (!Array.isArray(value.repositories)) {
    throw new Error('Observation file repositories must be an array');
  }
  const observation: PortfolioObservation = {
    eventId: stringValue(value.eventId, 'eventId'),
    observedAt: stringValue(value.observedAt, 'observedAt'),
    linear: {
      key: stringValue(value.linear.key, 'linear.key'),
      state: stringValue(value.linear.state, 'linear.state') as LinearLifecycleState,
    },
    buzz: {
      channelId: stringValue(value.buzz.channelId, 'buzz.channelId'),
      state: stringValue(value.buzz.state, 'buzz.state') as PortfolioObservation['buzz']['state'],
    },
    repositories: value.repositories.map(parseRepositoryObservation),
  };
  if (!['active', 'archived', 'missing'].includes(observation.buzz.state)) {
    throw new Error(`Invalid Buzz state: ${observation.buzz.state}`);
  }
  validateObservation(observation);
  return observation;
}

function parseRepositoryObservation(value: unknown): RepositoryObservation {
  if (!isRecord(value)) {
    throw new Error('Repository observation must be an object');
  }
  if (
    !Array.isArray(value.branches) ||
    !Array.isArray(value.worktrees) ||
    !Array.isArray(value.pullRequestUrls)
  ) {
    throw new Error('Repository observation artifacts must be arrays');
  }
  if (typeof value.localCheckoutPresent !== 'boolean') {
    throw new Error('Repository observation localCheckoutPresent must be boolean');
  }
  const state = stringValue(value.state, 'repository.state');
  if (state !== 'present' && state !== 'missing') {
    throw new Error(`Invalid repository state: ${state}`);
  }
  return {
    repositoryId: stringValue(value.repositoryId, 'repository.repositoryId'),
    state,
    providerRepositoryId: stringValue(
      value.providerRepositoryId,
      'repository.providerRepositoryId',
    ),
    owner: stringValue(value.owner, 'repository.owner'),
    name: stringValue(value.name, 'repository.name'),
    remoteUrl: stringValue(value.remoteUrl, 'repository.remoteUrl'),
    defaultBranch: stringValue(value.defaultBranch, 'repository.defaultBranch'),
    localCheckout: stringValue(value.localCheckout, 'repository.localCheckout'),
    localCheckoutPresent: value.localCheckoutPresent,
    branches: value.branches.map((x, index) => stringValue(x, `repository.branches[${index}]`)),
    worktrees: value.worktrees.map((x, index) => {
      if (!isRecord(x)) {
        throw new Error(`repository.worktrees[${index}] must be an object`);
      }
      return {
        path: stringValue(x.path, `repository.worktrees[${index}].path`),
        branch: stringValue(x.branch, `repository.worktrees[${index}].branch`),
      };
    }),
    pullRequestUrls: value.pullRequestUrls.map((x, index) =>
      stringValue(x, `repository.pullRequestUrls[${index}]`),
    ),
  };
}

function requireMapping(mappings: Record<string, TaskMapping>, issueKey: string) {
  const key = normalizeIssueKey(issueKey);
  const mapping = mappings[key];
  if (mapping === undefined) {
    throw new Error(`No mapping exists for ${key}`);
  }
  return mapping;
}

function repositoryId(provider: RepositoryProvider, providerRepositoryId: string) {
  return `${provider}:${providerRepositoryId}`;
}

function canonicalRemote(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error('Repository and pull-request URLs must use HTTPS');
  }
  return url
    .toString()
    .replace(/\/$/, '')
    .replace(/\.git$/, '');
}

function canonicalPath(value: string) {
  const style = absolutePathStyle(value);
  return style === 'windows' ? win32.normalize(value) : posix.normalize(value);
}

function sameRegistration(current: RepositoryRegistration, desired: RepositoryRegistration) {
  return (
    current.provider === desired.provider &&
    current.providerRepositoryId === desired.providerRepositoryId &&
    current.owner === desired.owner &&
    current.name === desired.name &&
    sameRemote(current.remoteUrl, desired.remoteUrl) &&
    current.defaultBranch === desired.defaultBranch &&
    samePath(current.localCheckout, desired.localCheckout) &&
    samePath(current.worktreeRoot, desired.worktreeRoot) &&
    current.archivePolicy === desired.archivePolicy
  );
}

function sameLink(current: PortfolioRepositoryLink, desired: PortfolioRepositoryLink) {
  return (
    current.repositoryId === desired.repositoryId &&
    current.role === desired.role &&
    current.branch === desired.branch &&
    ((current.worktree === null && desired.worktree === null) ||
      (current.worktree !== null &&
        desired.worktree !== null &&
        samePath(current.worktree, desired.worktree))) &&
    current.pullRequestUrl === desired.pullRequestUrl
  );
}

function sameRemote(first: string, second: string) {
  return canonicalRemote(first).toLowerCase() === canonicalRemote(second).toLowerCase();
}

function samePath(first: string, second: string) {
  const firstStyle = absolutePathStyle(first);
  const secondStyle = absolutePathStyle(second);
  if (firstStyle !== secondStyle) {
    return false;
  }
  const normalizedFirst = canonicalPath(first);
  const normalizedSecond = canonicalPath(second);
  return firstStyle === 'windows'
    ? normalizedFirst.toLowerCase() === normalizedSecond.toLowerCase()
    : normalizedFirst === normalizedSecond;
}

function absolutePathStyle(value: string): 'windows' | 'posix' {
  const hasWindowsDrive = /^[a-z]:[\\/]/i.test(value);
  const hasWindowsUncRoot = value.startsWith('\\\\');
  if ((hasWindowsDrive || hasWindowsUncRoot) && win32.isAbsolute(value)) {
    return 'windows';
  }
  if (posix.isAbsolute(value)) {
    return 'posix';
  }
  throw new Error('Repository and worktree paths must be absolute');
}

function hashObservation(value: PortfolioObservation) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function normalizeObservation(value: PortfolioObservation): PortfolioObservation {
  return {
    ...value,
    repositories: value.repositories
      .map(repository => ({
        ...repository,
        branches: [...repository.branches].sort(),
        worktrees: [...repository.worktrees].sort((a, b) =>
          [canonicalPath(a.path), a.branch]
            .join('\0')
            .localeCompare([canonicalPath(b.path), b.branch].join('\0')),
        ),
        pullRequestUrls: [...repository.pullRequestUrls].sort(),
      }))
      .sort((a, b) => a.repositoryId.localeCompare(b.repositoryId)),
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function stringValue(value: unknown, name: string) {
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a string`);
  }
  return value;
}

function assertNonempty(value: string, name: string) {
  if (value.trim() === '') {
    throw new Error(`--${name} is required`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
