export function firstBufferRuleSize(
  command: string,
  rules: readonly (readonly [string, number, number])[],
): [number, number] | undefined {
  const commandUpper = command.toUpperCase().trim();
  for (const rule of rules) {
    if (
      typeof rule[0] !== 'string' ||
      rule[0] === '' ||
      typeof rule[1] !== 'number' ||
      typeof rule[2] !== 'number'
    ) {
      continue;
    }
    // '*' is not a valid regex.
    const pattern = rule[0] === '*' ? '.*' : rule[0];
    const match = commandUpper.match(new RegExp(pattern.toUpperCase()));
    if (match !== null) {
      return [rule[1], rule[2]];
    }
  }
  return undefined;
}
