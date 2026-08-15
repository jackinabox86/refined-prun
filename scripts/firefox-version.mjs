import { pathToFileURL } from 'node:url';

export function createFirefoxVersion(date, runNumber) {
  if (Number.isNaN(date.getTime())) {
    throw new Error('Firefox release version requires a valid date.');
  }

  const parsedRunNumber = Number(runNumber);
  if (!Number.isSafeInteger(parsedRunNumber) || parsedRunNumber < 1) {
    throw new Error('Firefox release version requires a positive integer run number.');
  }

  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), parsedRunNumber].join(
    '.',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(createFirefoxVersion(new Date(), process.argv[2]));
}
