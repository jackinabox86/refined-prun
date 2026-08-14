# scripts/

## `ai-workflow/`

Manual-trigger Linear-to-Buzz task-channel reconciler and opt-in, replay-safe In Review projector. It keeps its mapping store outside the repository, provisions one channel/canvas per issue idempotently, preserves native merge-to-Done behavior, and archives only after an explicit confirmed command. See `scripts/ai-workflow/README.md`.

## `build-dist.sh`

Builds the extension and packages it as `dist.zip` at the repo root.

The source Font Awesome woff2 files in `src/assets/fonts/` are tracked via
Git LFS. In environments without `git-lfs` installed (CI without `lfs: true`,
agent sandboxes, fresh clones), those paths contain ~130-byte LFS pointer
files and the resulting build ships fonts that Chrome rejects with
`OTS parsing error: invalid sfntVersion: 1986359923`.

To sidestep that, real binaries are stored in `patches/fonts/` (exempted
from LFS filtering in `.gitattributes`). The script copies them into
`src/assets/fonts/` before invoking `pnpm build`, then zips `dist/` into
`dist.zip`.

Run it directly whenever an up-to-date `dist.zip` is needed (e.g. before a
release). There is no automation around it — a Claude Code hook that used to
run it after commits no longer exists.
