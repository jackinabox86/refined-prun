# WSL2 migration — step-by-step guide

Goal: run Claude Code inside WSL2 (required for the Bash sandbox — see
`wsl-sandbox-option.md` for why), with its own fresh clone of the repo rather than
reusing the Windows checkout. Nothing here has been executed — do this at your PC.

## 1. Install WSL2

1. Open PowerShell **as Administrator**.
2. Run `wsl --install` — on a fresh machine this installs WSL2 plus the default Ubuntu
   distro in one step. Reboot if prompted.
3. If WSL is already installed from something older, check the version instead:
   `wsl -l -v`. Every distro listed must show `VERSION 2`, not `1`. If a distro
   shows `1`, upgrade it: `wsl --set-version <distro-name> 2`.
4. Set WSL2 as the default for future distros: `wsl --set-default-version 2`.

## 2. Set up the Ubuntu distro

1. Launch "Ubuntu" from the Start menu (first launch finishes installation).
2. Create the Unix username/password when prompted — this is separate from your
   Windows login.
3. Update packages: `sudo apt update && sudo apt upgrade -y`.

## 3. Install Node.js and pnpm inside WSL2

1. Install Node via `nvm` (avoids apt's often-outdated Node):
   ```
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   ```
   Close and reopen the WSL2 terminal (or `source ~/.bashrc`), then:
   ```
   nvm install --lts
   ```
2. Install pnpm at the version pinned in `package.json`'s `packageManager` field
   (currently `10.32.1` — re-check after pulling if this has drifted; see
   `.claude/skills/run/SKILL.md` prerequisites for context):
   ```
   npm install -g pnpm@10.32.1
   ```
3. Verify: `node --version`, `pnpm --version`.

## 4. Set up GitHub access from WSL2

Pick one:

- **Share Windows' Git Credential Manager (recommended — reuses your existing login,
  no re-auth):**
  ```
  git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"
  ```
  (Adjust the path if Git for Windows is installed somewhere else — check with
  `where git-credential-manager` in a Windows terminal first.)
- **Or authenticate independently inside WSL2:**
  ```
  sudo apt install gh
  gh auth login
  ```
  Follow the prompts (browser-based auth is easiest).

Either way, set your git identity if not already global:
```
git config --global user.name "jackinabox86"
git config --global user.email "<your email>"
```

## 5. Clone a fresh copy of the repo

Do this inside WSL2's native filesystem, not under `/mnt/c/` — cross-filesystem I/O
through `/mnt/c` is noticeably slower for git/`node_modules`-heavy work (see
`wsl-sandbox-option.md`).

```
mkdir -p ~/code
cd ~/code
git clone https://github.com/jackinabox86/refined-prun.git
cd refined-prun
git checkout claude/contd-json-paste-import-wojmjm   # or whichever branch you're on
```

## 6. Install project dependencies

```
pnpm install
```

## 7. Re-create local-only setup (not tracked in git)

WSL2 can read the Windows drive directly at `/mnt/c/...`, so this is just file copies —
no network transfer needed. These three things exist on the Windows checkout but won't
carry over via `git clone` (the project's `.claude/settings.json` and `.claude/skills/*`
are committed, so those *do* come along automatically):

1. **`.claude/settings.local.json`** — your personal permission allowlist (gitignored):
   ```
   cp "/mnt/c/Users/cyrus/Codex/refined-prun/.claude/settings.local.json" \
      ~/code/refined-prun/.claude/settings.local.json
   ```
2. **`~/.claude/settings.json`** — user-level Claude Code settings (separate from the
   project one above; currently just `{"agentPushNotifEnabled": true}`):
   ```
   mkdir -p ~/.claude
   cp "/mnt/c/Users/cyrus/.claude/settings.json" ~/.claude/settings.json
   ```
3. **Memory files** (`MEMORY.md` + the feedback/project notes under
   `~/.claude/projects/<project-key>/memory/`) — these are keyed by a sanitized version
   of the project's full path, so the WSL2 clone gets a *different* project key than the
   Windows one. Run `claude` once inside the new clone first so it creates its own
   project folder, then copy the memory files in:
   ```
   cd ~/code/refined-prun && claude --version   # registers the project
   ls ~/.claude/projects/                        # find the new folder for this path
   mkdir -p ~/.claude/projects/<new-folder-name>/memory
   cp /mnt/c/Users/cyrus/.claude/projects/C--Users-cyrus-Codex-refined-prun/memory/*.md \
      ~/.claude/projects/<new-folder-name>/memory/
   ```

**`.local/pw-tools` and `.local/browser-profile`** (the Playwright install and the
persistent game-login browser profile) are handled separately in step 10 below, since
they depend on which browser ends up running the test harness.

## 8. Enable the Bash sandbox

1. Run `/sandbox` inside a Claude Code session in the WSL2 checkout.
2. On the **Mode** tab, choose **auto-allow**.
3. Add the CDP port to the network allowlist so `pw-act.mjs`'s `connectOverCDP` calls
   don't prompt: add `127.0.0.1` to `sandbox.allowedDomains` in `.claude/settings.json`
   (or approve it once when first prompted — from Claude Code v2.1.191+, approving a
   host holds for the rest of the session).
4. If the browser ends up being a Linux-native Chromium (step 10 below), it's a normal
   Linux process — no `excludedCommands` entry needed, and no "sandboxed commands can't
   launch Windows binaries" problem either, since nothing launches a Windows binary
   anymore.

## 9. Verify

```
pnpm run compile
pnpm run build:fast
git status
git commit --allow-empty -m "wsl setup check"   # then delete/reset it — just confirms
                                                  # credentials + identity work
```

## 10. Browser test harness: switch to a Linux-native Chromium

`scripts/local-browser-test.mjs` currently launches `msedge.exe` — a native Windows
process, which a sandboxed WSL2 command can't do at all (see step 8). The resolution:
run a Linux-native Chromium-based browser directly inside WSL2 instead. Confirmed via
research (not yet tested against this project specifically): Windows 11's **WSLg**
(GUI app support for WSL2, on by default) renders Linux GUI apps as normal, visible
Windows-desktop windows — taskbar entry, Alt+Tab, clipboard, GPU acceleration, no
headless mode or extra config required. So watching/screenshotting the browser should
work the same way it does today with `msedge.exe`. Requirement: a GPU driver from mid-2021
or later (DirectX 12 paravirtualization support) — check this first if the machine is old.

1. **Sanity-check WSLg itself** before touching the harness, so a failure later is
   clearly the harness's fault and not WSLg's:
   ```
   sudo apt install -y x11-apps
   xeyes
   ```
   A small window (a pair of eyes that follow your cursor) should appear on the Windows
   desktop. If it doesn't, troubleshoot WSLg first — nothing browser-related will show up
   either until this works.

2. **Get a Chromium binary.** Either works; pick one:
   - Let Playwright download its own (closer to a fresh install, simplest to reason
     about): inside `.local/pw-tools`, run `npx playwright install chromium` — note this
     is the opposite of the Windows setup, which passed
     `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` specifically because it reused the system Edge.
   - Or install a system Chromium: `sudo apt install -y chromium-browser`.

3. **Update the launch code** (an actual code change, not just config — do this when you
   get there, not blindly ahead of time): `scripts/pw-helper.mjs`/
   `scripts/local-browser-test.mjs` currently pass `channel: 'msedge'` to
   `launchPersistentContext`. Swap this for either `channel: 'chromium'` (system install)
   or drop `channel` entirely and let Playwright use its own downloaded browser. The
   `--load-extension=<dist>` / `--disable-extensions-except=<dist>` launch args are plain
   Chromium flags and should carry over unchanged.

4. **Everything downstream should be unaffected**: `pw-act.mjs`/`pw-screenshot.mjs` only
   talk to the browser over CDP (`connectOverCDP`), which doesn't care whether the
   browser is Windows or Linux — no changes expected there.

5. `.local/browser-profile` (the persistent game login) can't be copied over from
   Windows either way — it's tied to a specific browser install — so plan on logging into
   the game again once, same as any fresh profile.
