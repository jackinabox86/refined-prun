// Force-kills any leftover browser process tree still holding the
// .local/browser-profile lock (see .claude/skills/run/SKILL.md gotcha #9).
// A stale process here blocks local-browser-test.mjs from launching even right
// after a clean pw-close.mjs, with no other symptom than a launch error.
// Windows finds msedge.exe processes via PowerShell + taskkill; Linux/WSL2
// (the current setup — Playwright's own Chromium) matches any process whose
// command line references this profile dir. Both are scoped to this tool's own
// profile so they can't touch an unrelated browser window.
import { execFileSync } from 'node:child_process';
import { profileDir } from './pw-helper.mjs';

const isWindows = process.platform === 'win32';

function findPidsWindows() {
  const psScript = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${profileDir}*' } | Select-Object -ExpandProperty ProcessId`;
  const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
    encoding: 'utf8',
  });
  return out
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^\d+$/.test(line));
}

function findPidsLinux() {
  try {
    const out = execFileSync('pgrep', ['-f', '--', profileDir], { encoding: 'utf8' });
    return out
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^\d+$/.test(line));
  } catch {
    // pgrep exits 1 when nothing matches.
    return [];
  }
}

const pids = isWindows ? findPidsWindows() : findPidsLinux();
if (pids.length === 0) {
  console.log('No leftover browser processes found for this profile.');
  process.exit(0);
}

for (const pid of pids) {
  try {
    if (isWindows) {
      execFileSync('taskkill', ['/PID', pid, '/F', '/T'], { stdio: 'ignore' });
    } else {
      // Renderer/gpu children exit on their own once the main process (the
      // one holding the profile lock) is gone; any that also matched the
      // profile path are in this list anyway.
      process.kill(Number(pid), 'SIGKILL');
    }
  } catch {
    // Already gone — an earlier kill in this same loop may have taken it down.
  }
}
console.log(`Killed ${pids.length} leftover browser process(es) for this profile.`);
