import changelogRaw from '../../../../CHANGELOG.md?raw';
import { userData } from '@src/store/user-data';
import { saveUserData } from '@src/infrastructure/storage/user-data-serializer';

export interface ChangelogSection {
  category: string;
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  sections: ChangelogSection[];
}

function parseChangelog(text: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let release: ChangelogRelease | undefined;
  let section: ChangelogSection | undefined;

  for (const line of text.split('\n')) {
    const versionHeading = /^## (.+)$/.exec(line);
    if (versionHeading) {
      release = { version: versionHeading[1].trim(), sections: [] };
      releases.push(release);
      section = undefined;
      continue;
    }
    if (!release) {
      continue;
    }
    const categoryHeading = /^### (.+)$/.exec(line);
    if (categoryHeading) {
      section = { category: categoryHeading[1].trim(), items: [] };
      release.sections.push(section);
      continue;
    }
    const item = /^- (.+)$/.exec(line);
    if (item && section) {
      section.items.push(item[1].trim());
    }
  }

  return releases;
}

// Everything actually shipped to users: excludes "Unreleased" (not live yet) and
// boundary markers with no recorded entries (e.g. the "changelog starts here" release).
export const releasedChangelog = parseChangelog(changelogRaw).filter(
  release => release.version !== 'Unreleased' && release.sections.length > 0,
);

export const latestReleasedVersion = releasedChangelog[0]?.version as string | undefined;

export function hasUnseenChangelog(lastSeenVersion: string | undefined): boolean {
  return latestReleasedVersion !== undefined && lastSeenVersion !== latestReleasedVersion;
}

export async function markChangelogSeen() {
  if (latestReleasedVersion === undefined) {
    return;
  }
  userData.lastSeenChangelogVersion = latestReleasedVersion;
  await saveUserData();
}
