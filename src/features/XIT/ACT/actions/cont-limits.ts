// Field limits shared by the CONT actions and their steps.
// The contract template's price-per-unit field. Bounds match the game's own
// order limits; a trade contract with a missing or zero price would be sent as
// a giveaway, so every traded material has to carry one.
export const minContractPrice = 0.01;
export const maxContractPrice = 100000000;

// The deadline field's range, in days.
export const minContractDays = 1;
export const maxContractDays = 99;

export function isValidContractPrice(price: number | undefined): price is number {
  return (
    price !== undefined &&
    Number.isFinite(price) &&
    price >= minContractPrice &&
    price <= maxContractPrice
  );
}
