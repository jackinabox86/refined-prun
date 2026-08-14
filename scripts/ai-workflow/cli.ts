import { resolve } from 'node:path';
import { AttentionProjector } from './attention.ts';
import { BuzzCliGateway } from './buzz.ts';
import { LifecycleProjector } from './lifecycle.ts';
import {
  LINEAR_LIFECYCLE_STATES,
  ATTENTION_SIGNAL_KINDS,
  REPOSITORY_ARCHIVE_POLICIES,
  REPOSITORY_LINK_ROLES,
  REPOSITORY_PROVIDERS,
  REVIEW_EVENT_KINDS,
  parseMemberRole,
  normalizePubkey,
  type DesiredMember,
  type AttentionSignalKind,
  type LinearLifecycleState,
  type LinearStatusIds,
  type ReconcileRequest,
  type RepositoryArchivePolicy,
  type RepositoryLinkRole,
  type RepositoryProvider,
  type ReviewEventKind,
  type TaskMapping,
} from './model.ts';
import { PortfolioReconciler } from './portfolio.ts';
import { WorkflowReconciler } from './reconcile.ts';
import { JsonMappingStore } from './store.ts';

const SWITCHES = new Set([
  'adopt-existing',
  'confirm',
  'disable',
  'enable',
  'help',
  'replace-artifacts',
  'replace-metadata',
]);

async function main() {
  const rawArguments = process.argv.slice(2);
  const arguments_ = rawArguments[0] === '--' ? rawArguments.slice(1) : rawArguments;
  if (arguments_[0] === '--help') {
    process.stdout.write(helpText());
    return;
  }
  const parsed = parseArguments(arguments_);
  if (parsed.switches.has('help') || parsed.command === undefined) {
    process.stdout.write(helpText());
    return;
  }
  const storePath = option(parsed, 'store') ?? process.env.AI_WORKFLOW_MAPPING_STORE;
  if (storePath === undefined || storePath === '') {
    throw new Error(
      'Provide --store or AI_WORKFLOW_MAPPING_STORE; runtime state must stay outside the repo',
    );
  }
  const issueKey = parsed.issueKey;
  if (issueKey === undefined) {
    throw new Error('A Linear issue key is required');
  }

  const store = new JsonMappingStore(resolve(storePath));
  const buzz = new BuzzCliGateway(option(parsed, 'buzz-bin') ?? process.env.BUZZ_CLI ?? 'buzz');
  const reconciler = new WorkflowReconciler(store, buzz);
  const lifecycle = new LifecycleProjector(store);
  const attention = new AttentionProjector(store);
  const portfolio = new PortfolioReconciler(store);

  if (parsed.command === 'inspect') {
    printJson(await reconciler.inspect(issueKey));
    return;
  }
  if (parsed.command === 'archive') {
    printJson(
      await reconciler.archive(
        issueKey,
        parsed.switches.has('confirm'),
        optionalLinearState(option(parsed, 'linear-state')),
      ),
    );
    return;
  }
  if (parsed.command === 'repository-register') {
    const result = await portfolio.register({
      issueKey,
      provider: repositoryProvider(requiredOption(parsed, 'provider')),
      providerRepositoryId: requiredOption(parsed, 'provider-id'),
      owner: requiredOption(parsed, 'repository-owner'),
      name: requiredOption(parsed, 'repository-name'),
      remoteUrl: requiredOption(parsed, 'remote-url'),
      defaultBranch: requiredOption(parsed, 'default-branch'),
      localCheckout: requiredOption(parsed, 'local-checkout'),
      worktreeRoot: requiredOption(parsed, 'worktree-root'),
      archivePolicy: repositoryArchivePolicy(option(parsed, 'archive-policy') ?? 'retain'),
      replaceMetadata: parsed.switches.has('replace-metadata'),
    });
    printJson(await withCanvas(result, reconciler, issueKey));
    return;
  }
  if (parsed.command === 'portfolio-link') {
    const result = await portfolio.link({
      issueKey,
      repositoryId: requiredOption(parsed, 'repository-id'),
      role: repositoryLinkRole(requiredOption(parsed, 'role')),
      branch: option(parsed, 'artifact-branch'),
      worktree: option(parsed, 'artifact-worktree'),
      pullRequestUrl: option(parsed, 'pull-request-url'),
      replaceArtifacts: parsed.switches.has('replace-artifacts'),
    });
    printJson(await withCanvas(result, reconciler, issueKey));
    return;
  }
  if (parsed.command === 'portfolio-audit') {
    const result = await portfolio.auditFile(issueKey, requiredOption(parsed, 'observation-file'));
    printJson(await withCanvas(result, reconciler, issueKey));
    return;
  }
  if (parsed.command === 'attention-configure') {
    const enabled = exactlyOneSwitch(parsed, 'enable', 'disable') === 'enable';
    const result = await attention.configure({
      issueKey,
      enabled,
      staleAfterSeconds: integerOption(parsed, 'stale-after-seconds', 900),
      maxSignals: integerOption(parsed, 'max-signals', 100),
    });
    printJson(await withCanvas(result, reconciler, issueKey));
    return;
  }
  if (parsed.command === 'heartbeat') {
    const result = await attention.observe({
      issueKey,
      eventId: requiredOption(parsed, 'event-id'),
      kind: attentionSignalKind(requiredOption(parsed, 'kind')),
      owner: requiredOption(parsed, 'owner'),
      observedAt: option(parsed, 'observed-at'),
      reason: option(parsed, 'reason'),
      nextOwner: option(parsed, 'next-owner'),
    });
    printJson(await withCanvas(result, reconciler, issueKey));
    return;
  }
  if (parsed.command === 'attention-ack') {
    const result = await attention.acknowledge({
      issueKey,
      deliveryId: requiredOption(parsed, 'delivery-id'),
      result: acknowledgmentResult(requiredOption(parsed, 'result')),
      error: option(parsed, 'error'),
    });
    printJson(await withCanvas(result, reconciler, issueKey));
    return;
  }
  if (parsed.command === 'attention-reconcile') {
    const result = await attention.reconcile({
      issueKey,
      linearState: linearState(requiredOption(parsed, 'linear-state')),
      linearNeedsHuman: linearNeedsHuman(requiredOption(parsed, 'linear-needs-human')),
      now: option(parsed, 'now'),
    });
    printJson(await withCanvas(result, reconciler, issueKey));
    return;
  }
  if (parsed.command === 'lifecycle-configure') {
    const enabled = exactlyOneSwitch(parsed, 'enable', 'disable') === 'enable';
    printJson(
      await lifecycle.configure({
        issueKey,
        enabled,
        staleAfterSeconds: integerOption(parsed, 'stale-after-seconds', 300),
        maxDeliveries: integerOption(parsed, 'max-deliveries', 100),
      }),
    );
    return;
  }
  if (parsed.command === 'lifecycle-observe') {
    printJson(
      await lifecycle.observe({
        issueKey,
        eventId: requiredOption(parsed, 'event-id'),
        eventKind: eventKind(requiredOption(parsed, 'event-kind')),
        source: requiredOption(parsed, 'source'),
        linearState: linearState(requiredOption(parsed, 'linear-state')),
        observedAt: option(parsed, 'observed-at'),
      }),
    );
    return;
  }
  if (parsed.command === 'lifecycle-ack') {
    printJson(
      await lifecycle.acknowledge({
        issueKey,
        eventId: requiredOption(parsed, 'event-id'),
        result: acknowledgmentResult(requiredOption(parsed, 'result')),
        error: option(parsed, 'error'),
      }),
    );
    return;
  }
  if (parsed.command === 'lifecycle-reconcile') {
    printJson(
      await lifecycle.reconcile({
        issueKey,
        linearState: linearState(requiredOption(parsed, 'linear-state')),
        now: option(parsed, 'now'),
      }),
    );
    return;
  }
  if (parsed.command !== 'reconcile') {
    throw new Error(`Unknown command: ${parsed.command}`);
  }

  const result = await reconciler.reconcile(buildRequest(parsed, issueKey));
  printJson(result);
}

interface ParsedArguments {
  command?: string;
  issueKey?: string;
  options: Map<string, string[]>;
  switches: Set<string>;
}

function parseArguments(arguments_: string[]) {
  const parsed: ParsedArguments = {
    command: arguments_[0],
    issueKey: arguments_[1],
    options: new Map(),
    switches: new Set(),
  };
  let index = 2;
  while (index < arguments_.length) {
    const token = arguments_[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const name = token.slice(2);
    if (SWITCHES.has(name)) {
      parsed.switches.add(name);
      index += 1;
      continue;
    }
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${name}`);
    }
    const values = parsed.options.get(name) ?? [];
    values.push(value);
    parsed.options.set(name, values);
    index += 2;
  }
  return parsed;
}

function buildRequest(parsed: ParsedArguments, key: string) {
  const request: ReconcileRequest = {
    key,
    title: option(parsed, 'title'),
    linearUrl: option(parsed, 'linear-url'),
    linearIssueId: option(parsed, 'linear-issue-id'),
    teamId: option(parsed, 'team-id'),
    statusIds: statusIds(parsed),
    channelName: option(parsed, 'channel-name'),
    channelDescription: option(parsed, 'channel-description'),
    channelType: channelType(option(parsed, 'channel-type')),
    channelVisibility: channelVisibility(option(parsed, 'channel-visibility')),
    members: members(parsed.options.get('member')),
    repository: option(parsed, 'repo'),
    branch: option(parsed, 'branch'),
    worktree: option(parsed, 'worktree'),
    owner: option(parsed, 'owner'),
    adoptExisting: parsed.switches.has('adopt-existing'),
  };
  return request;
}

function statusIds(parsed: ParsedArguments): LinearStatusIds | undefined {
  const values = {
    todo: option(parsed, 'status-todo-id'),
    inProgress: option(parsed, 'status-in-progress-id'),
    inReview: option(parsed, 'status-in-review-id'),
    done: option(parsed, 'status-done-id'),
  };
  if (Object.values(values).every(x => x === undefined)) {
    return undefined;
  }
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) {
      throw new Error(`--status-${toKebabCase(name)}-id is required with other status IDs`);
    }
  }
  return values as LinearStatusIds;
}

function members(values: string[] | undefined): DesiredMember[] | undefined {
  if (values === undefined) {
    return undefined;
  }
  return values.map(value => {
    const [pubkey, role = 'member', ...extra] = value.split(':');
    if (extra.length > 0) {
      throw new Error(`Invalid --member value: ${value}`);
    }
    return { pubkey: normalizePubkey(pubkey), role: parseMemberRole(role) };
  });
}

function channelType(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }
  if (value !== 'stream' && value !== 'forum') {
    throw new Error(`Invalid --channel-type: ${value}`);
  }
  return value;
}

function channelVisibility(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }
  if (value !== 'open' && value !== 'private') {
    throw new Error(`Invalid --channel-visibility: ${value}`);
  }
  return value;
}

function option(parsed: ParsedArguments, name: string) {
  const values = parsed.options.get(name);
  if (values === undefined) {
    return undefined;
  }
  if (values.length !== 1) {
    throw new Error(`--${name} may be provided only once`);
  }
  return values[0];
}

function requiredOption(parsed: ParsedArguments, name: string) {
  const value = option(parsed, name);
  if (value === undefined || value === '') {
    throw new Error(`--${name} is required`);
  }
  return value;
}

function integerOption(parsed: ParsedArguments, name: string, defaultValue: number) {
  const value = option(parsed, name);
  if (value === undefined) {
    return defaultValue;
  }
  const parsedValue = Number(value);
  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsedValue;
}

function exactlyOneSwitch(parsed: ParsedArguments, first: string, second: string) {
  const present = [first, second].filter(x => parsed.switches.has(x));
  if (present.length !== 1) {
    throw new Error(`Provide exactly one of --${first} or --${second}`);
  }
  return present[0];
}

function eventKind(value: string): ReviewEventKind {
  if (!REVIEW_EVENT_KINDS.includes(value as ReviewEventKind)) {
    throw new Error(`Invalid --event-kind: ${value}`);
  }
  return value as ReviewEventKind;
}

function linearState(value: string): LinearLifecycleState {
  if (!LINEAR_LIFECYCLE_STATES.includes(value as LinearLifecycleState)) {
    throw new Error(`Invalid --linear-state: ${value}`);
  }
  return value as LinearLifecycleState;
}

function optionalLinearState(value: string | undefined) {
  return value === undefined ? undefined : linearState(value);
}

function attentionSignalKind(value: string): AttentionSignalKind {
  if (!ATTENTION_SIGNAL_KINDS.includes(value as AttentionSignalKind)) {
    throw new Error(`Invalid --kind: ${value}`);
  }
  return value as AttentionSignalKind;
}

function linearNeedsHuman(value: string) {
  if (value !== 'present' && value !== 'absent') {
    throw new Error(`Invalid --linear-needs-human: ${value}`);
  }
  return value === 'present';
}

function acknowledgmentResult(value: string) {
  if (value !== 'applied' && value !== 'failed') {
    throw new Error(`Invalid --result: ${value}`);
  }
  return value;
}

function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function withCanvas<T extends { mapping: TaskMapping }>(
  result: T,
  reconciler: WorkflowReconciler,
  issueKey: string,
) {
  const canvas = await reconciler.reconcile({ key: issueKey });
  return { ...result, mapping: canvas.mapping, canvasActions: canvas.actions };
}

function repositoryProvider(value: string): RepositoryProvider {
  if (!REPOSITORY_PROVIDERS.includes(value as RepositoryProvider)) {
    throw new Error(`Invalid --provider: ${value}`);
  }
  return value as RepositoryProvider;
}

function repositoryLinkRole(value: string): RepositoryLinkRole {
  if (!REPOSITORY_LINK_ROLES.includes(value as RepositoryLinkRole)) {
    throw new Error(`Invalid --role: ${value}`);
  }
  return value as RepositoryLinkRole;
}

function repositoryArchivePolicy(value: string): RepositoryArchivePolicy {
  if (!REPOSITORY_ARCHIVE_POLICIES.includes(value as RepositoryArchivePolicy)) {
    throw new Error(`Invalid --archive-policy: ${value}`);
  }
  return value as RepositoryArchivePolicy;
}

function toKebabCase(value: string) {
  return value.replaceAll(/[A-Z]/g, x => `-${x.toLowerCase()}`);
}

function helpText() {
  return `Linear-Buzz workflow reconciler

Usage:
  pnpm workflow reconcile ISSUE-ID --store PATH [metadata options]
  pnpm workflow inspect ISSUE-ID --store PATH
  pnpm workflow archive ISSUE-ID --store PATH --confirm --linear-state done
  pnpm workflow attention-configure ISSUE-ID --store PATH --enable|--disable
  pnpm workflow heartbeat ISSUE-ID --store PATH --event-id ID --kind KIND --owner OWNER
  pnpm workflow attention-ack ISSUE-ID --store PATH --delivery-id ID --result applied|failed
  pnpm workflow attention-reconcile ISSUE-ID --store PATH --linear-state STATE --linear-needs-human present|absent
  pnpm workflow repository-register ISSUE-ID --store PATH --provider github --provider-id ID [metadata options]
  pnpm workflow portfolio-link ISSUE-ID --store PATH --repository-id ID --role primary|related
  pnpm workflow portfolio-audit ISSUE-ID --store PATH --observation-file ABSOLUTE_PATH
  pnpm workflow lifecycle-configure ISSUE-ID --store PATH --enable|--disable
  pnpm workflow lifecycle-observe ISSUE-ID --store PATH --event-id ID --event-kind KIND --source URL --linear-state STATE
  pnpm workflow lifecycle-ack ISSUE-ID --store PATH --event-id ID --result applied|failed [--error TEXT]
  pnpm workflow lifecycle-reconcile ISSUE-ID --store PATH --linear-state STATE [--now ISO]

First reconcile requires:
  --title --linear-url --team-id
  --status-todo-id --status-in-progress-id --status-in-review-id --status-done-id
  --channel-name --repo --branch --worktree --owner

Optional:
  --linear-issue-id UUID
  --channel-description TEXT
  --channel-type stream|forum
  --channel-visibility open|private
  --member PUBKEY:owner|admin|member|guest|bot (repeatable)
  --adopt-existing
  --buzz-bin PATH

Lifecycle options:
  --event-kind ready-for-review|review-activity
  --linear-state todo|in-progress|in-review|done|other
  --observed-at ISO
  --stale-after-seconds N (default 300)
  --max-deliveries N (default 100)

Attention options:
  --kind progress|stall|recovery|handoff
  --observed-at ISO
  --reason TEXT (required for stall; concise structured reason, not chat)
  --next-owner OWNER (required for handoff)
  --linear-needs-human present|absent
  --stale-after-seconds N (default 900)
  --max-signals N (default 100)

Repository and portfolio options:
  --provider github --provider-id IMMUTABLE_PROVIDER_ID
  --repository-owner OWNER --repository-name NAME --remote-url URL
  --default-branch NAME --local-checkout ABSOLUTE_PATH --worktree-root ABSOLUTE_PATH
  --archive-policy retain [--replace-metadata]
  --repository-id PROVIDER:ID --role primary|related
  --artifact-branch NAME --artifact-worktree ABSOLUTE_PATH --pull-request-url URL
  --replace-artifacts
`;
}

async function run() {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

void run();
