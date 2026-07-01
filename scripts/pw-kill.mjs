// Force-kills any leftover msedge.exe process tree still holding the
// .local/browser-profile lock (see docs/../.claude/skills/run/SKILL.md gotcha #9).
// A stale process here blocks local-browser-test.mjs from launching even right
// after a clean pw-close.mjs, with no other symptom than a launch error.
import { execFileSync } from 'node:child_process';
import { profileDir } from './pw-helper.mjs';

function findPids() {
  const psScript = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${profileDir}*' } | Select-Object -ExpandProperty ProcessId`;
  const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
    encoding: 'utf8',
  });
  return out
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /^\d+$/.test(line));
}

const pids = findPids();
if (pids.length === 0) {
  console.log('No leftover msedge.exe processes found for this profile.');
  process.exit(0);
}

for (const pid of pids) {
  try {
    execFileSync('taskkill', ['/PID', pid, '/F', '/T'], { stdio: 'ignore' });
  } catch {
    // Already gone — an earlier /T call in this same loop may have killed it as a child.
  }
}
console.log(`Killed ${pids.length} leftover msedge.exe process(es) for this profile.`);
