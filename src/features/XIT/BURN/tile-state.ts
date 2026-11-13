import { createTileStateHook } from '@src/store/user-data-tiles';

export const useTileState = createTileStateHook({
  red: true,
  yellow: true,
  green: true,
  inf: true,
  prod: true,
  wf: true,
  io: false,
  // Count goods bought under a BUY contract that the partner hasn't delivered yet.
  buyCont: true,
  // Planets whose contract cargo is excluded.
  excludeContracts: [] as string[],
  // Planets whose production inputs are supplied by someone else.
  managed: [] as string[],
  expand: [] as string[],
});
