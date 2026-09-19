export interface Config {
  exchange?: string;
  skip?: boolean;
  // BURNACT: do not invent AI1 for a base that has never had a selection.
  noDefaultExchange?: boolean;
}
