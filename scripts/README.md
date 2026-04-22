# scripts/

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

Run it directly, or let the Claude Code PostToolUse hook in
`.claude/settings.json` run it automatically after every `git commit` on
non-`main` branches (auto-commits the updated `dist.zip` with an
`[auto-dist]` marker to break the loop).
