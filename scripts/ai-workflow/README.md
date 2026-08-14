# Linear-Buzz workflow reconciler

Manual-trigger Phase 2 bridge for one Linear issue to one Buzz task channel. It stores structured pointers, creates or recovers one channel, keeps the channel canvas current, and archives only after an explicit command.

The bridge does not call Linear directly. The initiating agent reads Linear through its authenticated connector and supplies the issue snapshot on the first reconcile. Later reconciles need only the issue key and mapping store. This keeps OAuth credentials out of the repository and mapping data.

## Runtime state

Keep the mapping store outside the repository. Set `AI_WORKFLOW_MAPPING_STORE` or pass `--store` on every invocation. The store uses schema version 1, atomic replacement, and a local lock file.

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

## Recovery and archive

```powershell
pnpm workflow reconcile JAC-6 --store $env:AI_WORKFLOW_MAPPING_STORE
pnpm workflow inspect JAC-6 --store $env:AI_WORKFLOW_MAPPING_STORE
pnpm workflow archive JAC-6 --store $env:AI_WORKFLOW_MAPPING_STORE --confirm
```

Archive is idempotent. A later reconcile preserves the archived mapping and never creates a replacement channel. The tool has no delete operation.

## Validation

Run the full repository checks:

```powershell
pnpm run compile
pnpm run test
```
