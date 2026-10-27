// Layout of the Promotion Options modal (ENG-764).
//
// Tiers wrap in a grid instead of scrolling sideways: a customer can configure
// any number of tiers, and a horizontal row with a hidden scrollbar made the
// ones past the third look cut off rather than "keep going".

/** Cards per row at full width. At most 4 — narrower cards get unreadable. */
export function promotionColumns(tierCount: number): 1 | 2 | 3 | 4 {
  if (tierCount <= 1) return 1;
  if (tierCount <= 4) return tierCount as 2 | 3 | 4;
  // Past four, pick the column count that leaves the fuller last row:
  // 5 → 3+2 rather than 4+1, 6 → 3+3, 7 → 4+3, 8 → 4+4.
  const lastRowOf4 = tierCount % 4 || 4;
  const lastRowOf3 = tierCount % 3 || 3;
  return lastRowOf4 / 4 >= lastRowOf3 / 3 ? 4 : 3;
}

/** Modal max-width for a column count — roughly 15–18rem per card. */
export function promotionModalMaxWidth(columns: number): string {
  return ({ 1: "28rem", 2: "42rem", 3: "60rem", 4: "72rem" } as Record<number, string>)[columns] ?? "72rem";
}

/**
 * Grid classes per column count. Spelled out in full so Tailwind's scanner
 * sees every class. Breakpoints track the iframe width — the modal's width
 * does too, so narrow embeds drop columns instead of squeezing cards.
 */
export const PROMOTION_GRID_CLASSES: Record<1 | 2 | 3 | 4, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};
