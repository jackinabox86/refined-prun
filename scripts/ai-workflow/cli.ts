import { resolve } from 'node:path';
import { BuzzCliGateway } from './buzz.ts';
import {
  parseMemberRole,
  normalizePubkey,
  type DesiredMember,
  type LinearStatusIds,
  type ReconcileRequest,
} from './model.ts';
import { WorkflowReconciler } from './reconcile.ts';
import { JsonMappingStore } from './store.ts';

const SWITCHES = new Set(['adopt-existing', 'confirm', 'help']);

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

  if (parsed.command === 'inspect') {
    printJson(await reconciler.inspect(issueKey));
    return;
  }
  if (parsed.command === 'archive') {
    printJson(await reconciler.archive(issueKey, parsed.switches.has('confirm')));
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

function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function toKebabCase(value: string) {
  return value.replaceAll(/[A-Z]/g, x => `-${x.toLowerCase()}`);
}

function helpText() {
  return `Linear-Buzz workflow reconciler

Usage:
  pnpm workflow reconcile ISSUE-ID --store PATH [metadata options]
  pnpm workflow inspect ISSUE-ID --store PATH
  pnpm workflow archive ISSUE-ID --store PATH --confirm

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
