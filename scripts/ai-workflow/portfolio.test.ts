import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createMapping, emptyStore, type ReconcileRequest } from './model.ts';
import { PortfolioReconciler, type PortfolioObservation } from './portfolio.ts';
import { JsonMappingStore } from './store.ts';

const temporaryDirectories: string[] = [];
const STORE_TIME = '2026-08-14T13:00:00.000Z';
const REFINED_ID = 'github:R_REFINED';
const APXM_ID = 'github:R_APXM';
const WORKTREE = 'C:\\nest\\REPOS\\worktrees\\JAC-9-multi-repo-portfolio';
const POSIX_WORKTREE = '/nest/REPOS/worktrees/JAC-9-multi-repo-portfolio';

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('PortfolioReconciler', () => {
  it('registers and links two repositories idempotently', async () => {
    const { portfolio, store } = await harness();

    const first = await portfolio.register(refinedRegistration());
    const replay = await portfolio.register(refinedRegistration());
    await portfolio.register(apxmRegistration());
    await portfolio.link(primaryLink());
    const related = await portfolio.link(relatedLink());
    const relatedReplay = await portfolio.link(relatedLink());

    expect(first.repository.id).toBe(REFINED_ID);
    expect(replay.actions).toEqual([{ type: 'none', reason: 'repository-registration-current' }]);
    expect(related.mapping.portfolio.repositories).toHaveLength(2);
    expect(relatedReplay.actions).toEqual([{ type: 'none', reason: 'repository-link-current' }]);
    expect(Object.keys((await store.read()).repositories)).toEqual([REFINED_ID, APXM_ID]);
  });

  it('emits one drift alert, suppresses replays, and clears only on healthy truth', async () => {
    const { portfolio } = await linkedHarness();
    const healthy = healthyObservation('portfolio:JAC-9:healthy-1');
    const current = await portfolio.audit('JAC-9', healthy);
    const reorderedReplay = structuredClone(healthy);
    reorderedReplay.repositories.reverse();
    reorderedReplay.repositories[1].branches.reverse();
    const replay = await portfolio.audit('JAC-9', reorderedReplay);

    const drift = healthyObservation('portfolio:JAC-9:drift-1');
    drift.repositories[0].worktrees = [];
    drift.repositories[1].name = 'APXM-renamed';
    const attention = await portfolio.audit('JAC-9', drift);
    const repeatedDrift = healthyObservation('portfolio:JAC-9:drift-2');
    repeatedDrift.repositories[0].worktrees = [];
    repeatedDrift.repositories[1].name = 'APXM-renamed';
    const noDuplicate = await portfolio.audit('JAC-9', repeatedDrift);
    const recovered = await portfolio.audit(
      'JAC-9',
      healthyObservation('portfolio:JAC-9:healthy-2'),
    );

    expect(current.actions).toEqual([{ type: 'none', reason: 'portfolio-current' }]);
    expect(replay.actions).toEqual([{ type: 'none', reason: 'portfolio-observation-replayed' }]);
    expect(attention.actions).toHaveLength(1);
    expect(attention.actions[0].type).toBe('needs-attention');
    expect(attention.mapping.portfolio.alert.findings.map(x => x.code)).toEqual([
      'repository-name-mismatch',
      'linked-worktree-missing',
    ]);
    expect(noDuplicate.actions).toEqual([{ type: 'none', reason: 'portfolio-alert-current' }]);
    expect(recovered.actions).toEqual([{ type: 'none', reason: 'portfolio-alert-cleared' }]);
    expect(recovered.mapping.portfolio.alert.state).toBe('clear');
    expect(recovered.mapping.portfolio.audits).toHaveLength(4);
  });

  it('rejects conflicting event identities and unregistered observations', async () => {
    const { portfolio } = await linkedHarness();
    const first = healthyObservation('portfolio:JAC-9:1');
    await portfolio.audit('JAC-9', first);
    const conflict = healthyObservation('portfolio:JAC-9:1');
    conflict.observedAt = '2026-08-14T13:01:00.000Z';

    await expect(portfolio.audit('JAC-9', conflict)).rejects.toThrow(
      'Portfolio event identity conflicts',
    );

    const unknown = healthyObservation('portfolio:JAC-9:2');
    unknown.repositories.push({ ...unknown.repositories[1], repositoryId: 'github:R_UNKNOWN' });
    await expect(portfolio.audit('JAC-9', unknown)).rejects.toThrow('unregistered repository');
  });

  it('requires explicit replacement for reviewed metadata changes', async () => {
    const { portfolio } = await harness();
    await portfolio.register(refinedRegistration());

    const renamed = {
      ...refinedRegistration(),
      name: 'renamed',
      remoteUrl: 'https://github.com/jackinabox86/renamed',
    };
    await expect(portfolio.register(renamed)).rejects.toThrow('use --replace-metadata');

    const replaced = await portfolio.register({
      ...renamed,
      replaceMetadata: true,
    });
    expect(replaced.repository.name).toBe('renamed');
  });

  it('supports both path styles with their native case semantics', async () => {
    const windows = await linkedHarness();
    const windowsObservation = healthyObservation('portfolio:JAC-9:windows-case');
    windowsObservation.repositories[0].localCheckout = 'c:\\NEST\\repos\\REFINED-PRUN';
    windowsObservation.repositories[0].worktrees[0].path =
      'c:\\NEST\\repos\\WORKTREES\\jac-9-MULTI-REPO-PORTFOLIO';
    windowsObservation.repositories[1].localCheckout = 'c:\\NEST\\repos\\apxm';
    const windowsResult = await windows.portfolio.audit('JAC-9', windowsObservation);
    expect(windowsResult.mapping.portfolio.alert.findings).toEqual([]);

    const posix = await harness(POSIX_WORKTREE);
    await posix.portfolio.register({
      ...refinedRegistration(),
      localCheckout: '/nest/REPOS/refined-prun',
      worktreeRoot: '/nest/REPOS/worktrees',
    });
    await posix.portfolio.register({
      ...apxmRegistration(),
      localCheckout: '/nest/REPOS/APXM',
      worktreeRoot: '/nest/REPOS/worktrees',
    });
    await posix.portfolio.link({ ...primaryLink(), worktree: POSIX_WORKTREE });
    await posix.portfolio.link(relatedLink());

    const posixHealthy = posixObservation('portfolio:JAC-9:posix-healthy');
    const posixCurrent = await posix.portfolio.audit('JAC-9', posixHealthy);
    expect(posixCurrent.mapping.portfolio.alert.findings).toEqual([]);

    const posixCaseDrift = posixObservation('portfolio:JAC-9:posix-case-drift');
    posixCaseDrift.repositories[0].localCheckout = '/NEST/REPOS/refined-prun';
    posixCaseDrift.repositories[0].worktrees[0].path =
      '/NEST/REPOS/worktrees/JAC-9-multi-repo-portfolio';
    const posixDrift = await posix.portfolio.audit('JAC-9', posixCaseDrift);
    expect(posixDrift.mapping.portfolio.alert.findings.map(x => x.code)).toEqual([
      'linked-worktree-missing',
      'local-checkout-mismatch',
    ]);
  });
});

async function linkedHarness() {
  const result = await harness();
  await result.portfolio.register(refinedRegistration());
  await result.portfolio.register(apxmRegistration());
  await result.portfolio.link(primaryLink());
  await result.portfolio.link(relatedLink());
  return result;
}

async function harness(worktree = WORKTREE) {
  const directory = await mkdtemp(join(tmpdir(), 'ai-portfolio-'));
  temporaryDirectories.push(directory);
  const store = new JsonMappingStore(join(directory, 'mappings.json'));
  const data = emptyStore();
  data.mappings['JAC-9'] = createMapping(seed(worktree), 'channel-id', STORE_TIME);
  data.mappings['JAC-9'].execution.observedState = 'active';
  await store.write(data);
  return {
    store,
    portfolio: new PortfolioReconciler(store, () => new Date(STORE_TIME)),
  };
}

function refinedRegistration() {
  return {
    issueKey: 'JAC-9',
    provider: 'github' as const,
    providerRepositoryId: 'R_REFINED',
    owner: 'jackinabox86',
    name: 'refined-prun',
    remoteUrl: 'https://github.com/jackinabox86/refined-prun',
    defaultBranch: 'main',
    localCheckout: 'C:\\nest\\REPOS\\refined-prun',
    worktreeRoot: 'C:\\nest\\REPOS\\worktrees',
    archivePolicy: 'retain' as const,
    replaceMetadata: false,
  };
}

function apxmRegistration() {
  return {
    issueKey: 'JAC-9',
    provider: 'github' as const,
    providerRepositoryId: 'R_APXM',
    owner: 'jackinabox86',
    name: 'APXM',
    remoteUrl: 'https://github.com/jackinabox86/APXM',
    defaultBranch: 'main',
    localCheckout: 'C:\\nest\\REPOS\\APXM',
    worktreeRoot: 'C:\\nest\\REPOS\\worktrees',
    archivePolicy: 'retain' as const,
    replaceMetadata: false,
  };
}

function primaryLink() {
  return {
    issueKey: 'JAC-9',
    repositoryId: REFINED_ID,
    role: 'primary' as const,
    branch: 'JAC-9-multi-repo-portfolio',
    worktree: WORKTREE,
    replaceArtifacts: false,
  };
}

function relatedLink() {
  return {
    issueKey: 'JAC-9',
    repositoryId: APXM_ID,
    role: 'related' as const,
    replaceArtifacts: false,
  };
}

function healthyObservation(eventId: string): PortfolioObservation {
  return {
    eventId,
    observedAt: STORE_TIME,
    linear: { key: 'JAC-9', state: 'in-progress' },
    buzz: { channelId: 'channel-id', state: 'active' },
    repositories: [
      {
        repositoryId: REFINED_ID,
        state: 'present',
        providerRepositoryId: 'R_REFINED',
        owner: 'jackinabox86',
        name: 'refined-prun',
        remoteUrl: 'https://github.com/jackinabox86/refined-prun',
        defaultBranch: 'main',
        localCheckout: 'C:\\nest\\REPOS\\refined-prun',
        localCheckoutPresent: true,
        branches: ['main', 'JAC-9-multi-repo-portfolio'],
        worktrees: [{ path: WORKTREE, branch: 'JAC-9-multi-repo-portfolio' }],
        pullRequestUrls: [],
      },
      {
        repositoryId: APXM_ID,
        state: 'present',
        providerRepositoryId: 'R_APXM',
        owner: 'jackinabox86',
        name: 'APXM',
        remoteUrl: 'https://github.com/jackinabox86/APXM',
        defaultBranch: 'main',
        localCheckout: 'C:\\nest\\REPOS\\APXM',
        localCheckoutPresent: true,
        branches: ['main'],
        worktrees: [],
        pullRequestUrls: [],
      },
    ],
  };
}

function posixObservation(eventId: string): PortfolioObservation {
  const observation = healthyObservation(eventId);
  observation.repositories[0].localCheckout = '/nest/REPOS/refined-prun';
  observation.repositories[0].worktrees[0].path = POSIX_WORKTREE;
  observation.repositories[1].localCheckout = '/nest/REPOS/APXM';
  return observation;
}

function seed(worktree = WORKTREE): ReconcileRequest {
  return {
    key: 'JAC-9',
    title: '[Phase 5] Multi-repo portfolio reconciliation',
    linearUrl: 'https://linear.app/example/issue/JAC-9/example',
    teamId: 'team-id',
    statusIds: { todo: 'todo', inProgress: 'working', inReview: 'review', done: 'done' },
    channelName: 'JAC-9-multi-repo-portfolio',
    repository: 'https://github.com/jackinabox86/refined-prun',
    branch: 'JAC-9-multi-repo-portfolio',
    worktree,
    owner: 'Codex Sol',
  };
}
