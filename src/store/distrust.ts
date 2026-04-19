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
  const users = usersStore.all.value;
  if (!users) {
    return false;
  }
  const upperCode = code?.toUpperCase();
  const upperName = name?.toUpperCase();
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
