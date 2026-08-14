# Linear-Buzz workflow reconciler, lifecycle, and attention projector

Manual-trigger bridge for one Linear issue to one Buzz task channel. It stores structured pointers, creates or recovers one channel, keeps the channel canvas current, and archives only after verified completion. Its opt-in lifecycle projector handles only the measured In Progress to In Review gap. Its opt-in attention projector tracks heartbeat, stalls, recovery, and ownership handoff without storing chat. Native GitHub-to-Linear merge-to-Done remains primary.

The bridge does not call Linear directly. The initiating agent reads Linear through its authenticated connector and supplies the issue snapshot on the first reconcile. Later reconciles need only the issue key and mapping store. This keeps OAuth credentials out of the repository and mapping data.

## Runtime state

Keep the mapping store outside the repository. Set `AI_WORKFLOW_MAPPING_STORE` or pass `--store` on every invocation. The store uses schema version 3, atomic replacement, and a local lock file. Existing schema-v1 and schema-v2 mappings migrate on the next write without losing lifecycle or archive state.

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

## Structured attention and heartbeat

Enable heartbeat monitoring for the mapping's exact Linear team and repository scope:

```powershell
pnpm workflow attention-configure JAC-8 --store $env:AI_WORKFLOW_MAPPING_STORE `
  --enable --stale-after-seconds 900 --max-signals 100
```

Record stable, replay-safe signals. A progress heartbeat starts or renews the lease. A stall requires a concise structured reason. Recovery is explicit, so ordinary progress cannot silently clear a human-attention request. Handoff changes only the owner while retaining the same branch and worktree.

```powershell
pnpm workflow heartbeat JAC-8 --store $env:AI_WORKFLOW_MAPPING_STORE `
  --event-id 'heartbeat:JAC-8:1' --kind progress --owner 'Codex Sol'

pnpm workflow heartbeat JAC-8 --store $env:AI_WORKFLOW_MAPPING_STORE `
  --event-id 'heartbeat:JAC-8:2' --kind stall --owner 'Codex Sol' `
  --reason 'waiting-for-human-decision'

pnpm workflow heartbeat JAC-8 --store $env:AI_WORKFLOW_MAPPING_STORE `
  --event-id 'heartbeat:JAC-8:3' --kind recovery --owner 'Codex Sol' `
  --reason 'decision-received'

pnpm workflow heartbeat JAC-8 --store $env:AI_WORKFLOW_MAPPING_STORE `
  --event-id 'heartbeat:JAC-8:4' --kind handoff --owner 'Codex Sol' `
  --next-owner 'Codex Terra' --reason 'verification-owner'
```

Manual reconciliation supplies current Linear lifecycle and label truth. When the output contains `set-linear-needs-human`, apply that label change through the authenticated Linear connector, then acknowledge the delivery. Duplicate signals and pending delivery replays produce no duplicate write. Reconciliation infers a lost acknowledgment when Linear already matches the desired label.

```powershell
pnpm workflow attention-reconcile JAC-8 --store $env:AI_WORKFLOW_MAPPING_STORE `
  --linear-state in-progress --linear-needs-human absent

pnpm workflow attention-ack JAC-8 --store $env:AI_WORKFLOW_MAPPING_STORE `
  --delivery-id '<delivery-id>' --result applied
```

Attention changes only Linear's `needs-human` label and the Buzz canvas. It never changes lifecycle status. The history is bounded, carries no credentials or chat, and records only stable signal identity, owner, time, handoff target, and concise reason.

## Recovery and archive

```powershell
pnpm workflow reconcile JAC-6 --store $env:AI_WORKFLOW_MAPPING_STORE
pnpm workflow inspect JAC-6 --store $env:AI_WORKFLOW_MAPPING_STORE
pnpm workflow archive JAC-6 --store $env:AI_WORKFLOW_MAPPING_STORE `
  --confirm --linear-state done
```

Archive is idempotent and completion-gated. It refuses an active mapping unless Linear is Done, lifecycle deliveries are resolved, and structured attention plus `needs-human` delivery state are clear. It writes a final canvas before archiving. A later reconcile preserves the archived mapping and never creates a replacement channel. The tool has no delete operation.

## Validation

Run the full repository checks:

```powershell
pnpm run compile
pnpm run test
```
