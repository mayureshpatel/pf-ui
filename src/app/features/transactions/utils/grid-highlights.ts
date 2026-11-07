/**
 * Which row highlights the toolbar above the transactions grid has switched on (PF-924). The
 * switches combine, so every one is its own flag. They are remembered only for the visit.
 */
export interface GridHighlights {
  /** Tints the empty Category cell of a row that has no category (transfers have none by design). */
  noCategory: boolean;
  /** Tints the empty Merchant cell of a row that has no merchant. */
  noMerchant: boolean;
  /** Marks, beside its description, a row that an existing category or merchant rule already covers (PF-925). */
  ruleCovers: boolean;
}

/** Every highlight off, the starting state. */
export const NO_HIGHLIGHTS: GridHighlights = {
  noCategory: false,
  noMerchant: false,
  ruleCovers: false,
};
