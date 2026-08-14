# Linear-Buzz workflow reconciler and lifecycle projector

Manual-trigger bridge for one Linear issue to one Buzz task channel. It stores structured pointers, creates or recovers one channel, keeps the channel canvas current, and archives only after an explicit command. Its opt-in lifecycle projector handles only the measured In Progress to In Review gap; native GitHub-to-Linear merge-to-Done remains primary.

The bridge does not call Linear directly. The initiating agent reads Linear through its authenticated connector and supplies the issue snapshot on the first reconcile. Later reconciles need only the issue key and mapping store. This keeps OAuth credentials out of the repository and mapping data.

## Runtime state

Keep the mapping store outside the repository. Set `AI_WORKFLOW_MAPPING_STORE` or pass `--store` on every invocation. The store uses schema version 2, atomic replacement, and a local lock file. Existing schema-v1 mappings migrate on the next write.

```powershell
$env:AI_WORKFLOW_MAPPING_STORE = 'C:\Users\cyrus\.buzz\.state\ai-workflow\mappings.json'
```

## First reconcile

```powershell
pnpm workflow reconcile JAC-6 `
  --title '[Phase 2] Build and prove the Linear-Buzz reconciler' `
  --linear-url 'https://linear.app/example/issue/JAC-6/example' `
  --team-id '<team-uuid>' `
  --status-todo-id '<status-uuid>' `
  --status-in-progress-id '<status-uuid>' `
  --status-in-review-id '<status-uuid>' `
  --status-done-id '<status-uuid>' `
  --channel-name 'JAC-6-linear-buzz-reconciler' `
  --repo 'https://github.com/jackinabox86/refined-prun' `
  --branch 'JAC-6-linear-buzz-reconciler' `
  --worktree 'C:\Users\cyrus\.buzz\REPOS\worktrees\JAC-6-linear-buzz-reconciler' `
  --owner 'Codex Sol' `
  --member '<human-pubkey>:owner'
```

If a verified channel already exists after an interrupted first run, add `--adopt-existing`. Adoption is never implicit.

## Review lifecycle projection

Enable the policy explicitly for the mapping's Linear team:

```powershell
pnpm workflow lifecycle-configure JAC-7 --store $env:AI_WORKFLOW_MAPPING_STORE `
  --enable --stale-after-seconds 300 --max-deliveries 100
```

For a GitHub ready-for-review or review-activity event, record the stable delivery identity and current Linear state:

```powershell
pnpm workflow lifecycle-observe JAC-7 --store $env:AI_WORKFLOW_MAPPING_STORE `
  --event-id 'github:jackinabox86/refined-prun:pull:152:ready-for-review:<head-sha>' `
  --event-kind ready-for-review `
  --source 'https://github.com/jackinabox86/refined-prun/pull/152' `
  --linear-state in-progress
```

When the result contains one `set-linear-status` action, apply that status through the authenticated Linear connector. Then acknowledge success or failure:

```powershell
pnpm workflow lifecycle-ack JAC-7 --store $env:AI_WORKFLOW_MAPPING_STORE `
  --event-id '<same-delivery-id>' --result applied

pnpm workflow lifecycle-ack JAC-7 --store $env:AI_WORKFLOW_MAPPING_STORE `
  --event-id '<same-delivery-id>' --result failed --error '<boundary error>'
```

Planning and acknowledgment are separate deliberately. A duplicate event while acknowledgment is pending produces no second write. Failed or stale deliveries remain retryable. If the Linear write succeeded but acknowledgment was lost, reconciliation infers success from current Linear truth:

```powershell
pnpm workflow lifecycle-reconcile JAC-7 --store $env:AI_WORKFLOW_MAPPING_STORE `
  --linear-state in-review
```

Reconciliation emits one stored attention signal for stale, failed, or unexpected state. A delivery observed after Done is recorded as ignored and can never regress the issue. The delivery ledger is bounded by the configured maximum and prunes only resolved entries.

The CLI does not contain Linear credentials or an always-on webhook listener. The authenticated operator supplies current Linear truth and applies the explicit action.

## Recovery and archive

```powershell
pnpm workflow reconcile JAC-6 --store $env:AI_WORKFLOW_MAPPING_STORE
pnpm workflow inspect JAC-6 --store $env:AI_WORKFLOW_MAPPING_STORE
pnpm workflow archive JAC-6 --store $env:AI_WORKFLOW_MAPPING_STORE --confirm
```

Archive is idempotent. A later reconcile preserves the archived mapping and never creates a replacement channel. The tool has no delete operation. Schema-v1 Phase 2 mappings migrate to schema v2 on the next write without losing channel or archive state.

## Validation

Run the full repository checks:

```powershell
pnpm run compile
pnpm run test
```
