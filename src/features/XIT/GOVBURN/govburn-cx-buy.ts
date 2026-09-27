// CX Buy subtracts warehouse stock unless the GOVBURNACT force toggle is on.
export function govBurnUseCXInv(forceCXBuy: boolean | undefined) {
  return forceCXBuy !== true;
}
