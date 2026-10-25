import { Merchant, TransactionDescription } from '@models/merchant.model';

/**
 * The second line of a merchant row: "City, ST", just one of them, or "No location".
 * @param merchant the merchant to describe.
 * @returns the location text.
 */
export function locationLabel(merchant: Merchant): string {
  const parts: string[] = [merchant.city, merchant.state]
    .map((part: string | null): string => (part ?? '').trim())
    .filter((part: string): boolean => part.length > 0);
  return parts.length > 0 ? parts.join(', ') : 'No location';
}

/**
 * How many descriptions a merchant has linked, in words.
 * @param count the number of links.
 * @returns "No links", "1 link" or "N links".
 */
export function linksLabel(count: number): string {
  if (count === 0) {
    return 'No links';
  }
  return count === 1 ? '1 link' : `${count} links`;
}

/**
 * The merchant total shown in the overview.
 * @param count the number of merchants.
 * @returns "1 merchant" or "N merchants".
 */
export function merchantCountLabel(count: number): string {
  return count === 1 ? '1 merchant' : `${count} merchants`;
}

/**
 * The overview sentence about transaction descriptions not yet linked to a merchant.
 * @param count how many descriptions are unlinked.
 * @returns the sentence, or the all-linked message at zero.
 */
export function unlinkedLabel(count: number): string {
  if (count === 0) {
    return 'Every transaction description is linked.';
  }
  return count === 1
    ? "1 transaction description isn't linked to a merchant."
    : `${count} transaction descriptions aren't linked to a merchant.`;
}

/**
 * Whether linking a description to the target merchant would move it away from another merchant.
 * @param row the picker row.
 * @param targetId the merchant being linked to, or null when none is chosen yet.
 * @returns true when the description is already linked to a different merchant.
 */
export function isMovingLink(row: TransactionDescription, targetId: number | null): boolean {
  return row.merchantId !== null && row.merchantId !== targetId;
}
