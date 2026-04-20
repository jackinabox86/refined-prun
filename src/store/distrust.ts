import { userData } from '@src/store/user-data';
import { usersStore } from '@src/infrastructure/prun-api/data/users';

const distrustedSet = computed(
  () => new Set(userData.distrustedUsernames.map(x => x.toUpperCase())),
);

export function isDistrustedUsername(username?: string | null) {
  if (!username) {
    return false;
  }
  return distrustedSet.value.has(username.toUpperCase());
}

export function isDistrustedCompany(code?: string | null, name?: string | null) {
  if (!code && !name) {
    return false;
  }
  const set = distrustedSet.value;
  // Direct match on the company code/name: a distrust entry can be a company
  // identifier, not just a username. Lets the user catch partners when the
  // username is unknown or the user's record is not in usersStore.
  const upperCode = code?.toUpperCase();
  const upperName = name?.toUpperCase();
  if (upperCode !== undefined && set.has(upperCode)) {
    return true;
  }
  if (upperName !== undefined && set.has(upperName)) {
    return true;
  }
  // Reverse-lookup via usersStore for entries the user typed as usernames.
  const users = usersStore.all.value;
  if (!users) {
    return false;
  }
  for (const user of users) {
    const companyMatches =
      (upperCode !== undefined && user.company.code.toUpperCase() === upperCode) ||
      (upperName !== undefined && user.company.name.toUpperCase() === upperName);
    if (companyMatches && isDistrustedUsername(user.username)) {
      return true;
    }
  }
  return false;
}

export function isDistrustedPartner(partner?: PrunApi.ContractPartner | null) {
  if (!partner) {
    return false;
  }
  return isDistrustedCompany(partner.code ?? null, partner.name ?? null);
}

export function setDistrustedUsernamesFromText(text: string) {
  userData.distrustedUsernames = text
    .split(/[\r\n,\t]+/)
    .map(x => x.trim())
    .filter(x => x.length > 0);
}
