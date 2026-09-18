export function cogcRepeatVoteCommand(alert?: PrunApi.Alert) {
  if (alert?.type !== 'COGC_PROGRAM_CHANGED') {
    return undefined;
  }

  const planet = planetNaturalIdFromAlert(alert);
  const program = programFromAlert(alert);
  if (planet === undefined || program === undefined) {
    return undefined;
  }

  return `COGCPD ${typedParam('p', planet)} ${typedParam('pn', program)}`;
}

function planetNaturalIdFromAlert(alert: PrunApi.Alert) {
  for (const item of alert.data) {
    if (item.key !== 'planet' && item.key !== 'address') {
      continue;
    }
    const address = (item.value as { address?: PrunApi.Address } | undefined)?.address;
    const fromPlanet = nonempty(address?.lines.find(x => x.type === 'PLANET')?.entity?.naturalId);
    if (fromPlanet !== undefined) {
      return fromPlanet;
    }
    const fromEntity = nonempty(address?.lines.find(x => x.entity?.naturalId)?.entity?.naturalId);
    if (fromEntity !== undefined) {
      return fromEntity;
    }
  }
  return nonempty(alert.naturalId);
}

function programFromAlert(alert: PrunApi.Alert) {
  const program = alert.data.find(x => x.key === 'program')?.value;
  return typeof program === 'string' ? nonempty(program) : undefined;
}

function typedParam(prefix: string, value: string) {
  const tag = `${prefix}-`;
  return value.startsWith(tag) ? value : `${tag}${value}`;
}

function nonempty(value?: string) {
  return value !== undefined && value !== '' ? value : undefined;
}
