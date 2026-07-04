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

These exist on the Windows checkout but won't carry over to a fresh clone:

- **`.claude/settings.local.json`** — your personal permission allowlist. Either let it
  rebuild naturally as you approve commands again, or manually copy over entries worth
  keeping from the Windows copy.
- **`.local/pw-tools`** — the isolated Playwright install for the browser test harness.
  Follow the "Isolated Playwright install" steps in `.claude/skills/run/SKILL.md`
  prerequisites, adjusted for Linux (the harness launches `msedge.exe` directly today,
  which is Windows-only — see the open question below before redoing this step).
- **`.local/browser-profile`** — the persistent browser profile with your game login.
  This one can't be copied over usefully if the browser itself ends up staying on the
  Windows side (see below); you'd log into the game again either way.

## 8. Enable the Bash sandbox

1. Run `/sandbox` inside a Claude Code session in the WSL2 checkout.
2. On the **Mode** tab, choose **auto-allow**.
3. Add the CDP port to the network allowlist so `pw-act.mjs`'s `connectOverCDP` calls
   don't prompt: add `127.0.0.1` to `sandbox.allowedDomains` in `.claude/settings.json`
   (or approve it once when first prompted — from Claude Code v2.1.191+, approving a
   host holds for the rest of the session).
4. Add whatever launches the browser to `sandbox.excludedCommands` — sandboxed WSL2
   commands can't launch Windows binaries at all, so this is required, not optional, if
   the browser stays native-Windows (see the open question below).

## 9. Verify

```
pnpm run compile
pnpm run build:fast
git status
git commit --allow-empty -m "wsl setup check"   # then delete/reset it — just confirms
                                                  # credentials + identity work
```

## Open question this guide doesn't resolve

**Where does the actual test browser run?** `scripts/local-browser-test.mjs` launches
`msedge.exe` — a native Windows process. From WSL2 that either means:
- (a) keep launching the browser from a Windows-side terminal/script while Claude Code
  itself runs in WSL2 and drives it — the two sides would need to agree on the CDP port
  and either share the repo path or run the harness scripts from both sides, or
- (b) find a Linux-native browser + extension-loading path instead (untested — Playwright
  can launch Linux Chromium/Edge inside WSL2 directly, but this project's harness is
  currently written around `channel: 'msedge'`).

Worth resolving before investing in the rest of this migration, since it's the part most
likely to not "just work."
