# Agent Worktrees and Handoffs

Use a dedicated Git worktree for each active task so concurrent agents do not
overwrite each other's changes or mix unrelated commits.

## Start a task

Keep the canonical clone clean on the default branch. Use it for fetching and
inspection, not implementation. Create one primary branch and worktree for each
task, named from a stable task key and a short slug:

```sh
git fetch origin
git worktree add -b <TASK-KEY>-<slug> <worktree-path> origin/main
```

Record the following values in the team's external task coordinator:

- Task key.
- Worktree path.
- Branch name.
- Base commit.
- Current owner.
- Execution state.

The recorded owner is the single writer for the primary worktree. Git prevents
the same branch from being checked out in two worktrees, but it does not prevent
multiple processes from editing one existing worktree.

## Pick up or recover a task

A handoff transfers the existing branch, worktree pointer, and ownership. Do not
create a competing branch for the same task. Before editing, verify the recorded
pointers and local state:

```sh
git worktree list --porcelain
git -C <worktree-path> branch --show-current
git -C <worktree-path> rev-parse HEAD
git -C <worktree-path> status --short
```

If the branch, commit, or worktree state does not match the task record, resolve
the discrepancy before making changes.

## Coordinate concurrent work

Independent subtasks use distinct branches and worktrees. If separate agents
must share a branch, assign explicit, non-overlapping file ownership and one
integrator. Do not let two agents write to the same files or worktree at once.

## Verify before push or cleanup

Before pushing or cleaning up task state, verify that:

- The worktree contains only the intended changes.
- Required commits are pushed to the expected remote branch.
- The branch is merged when the task requires a merge.
- No unique or unpushed commits would be lost.

Cleanup commands are deliberately omitted because cleanup is safe only after
these checks pass.
