import { components } from '../generated/api-types';

/**
 * Represents a merchant: a vendor the user deliberately named, never auto-created from a
 * transaction description.
 *
 * @property id - The unique identifier for the merchant.
 * @property userId - The user ID associated with the merchant.
 * @property name - The merchant's name, as the user typed it.
 * @property city - The merchant's city, if given.
 * @property state - The merchant's state/province, if given.
 * @property postalCode - The merchant's postal code, if given.
 * @property country - The merchant's country, if given.
 * @property linkCount - How many transaction descriptions are linked to the merchant.
 */
export interface Merchant {
  id: number;
  userId: number;
  name: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  linkCount?: number;
}

/**
 * Represents a request to create a new merchant.
 *
 * @property userId - The user ID associated with the merchant.
 * @property name - The merchant's name.
 * @property city - The merchant's city, optional.
 * @property state - The merchant's state/province, optional.
 * @property postalCode - The merchant's postal code, optional.
 * @property country - The merchant's country, optional.
 */
export interface MerchantCreateRequest {
  userId: number;
  name: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Represents a request to update an existing merchant's name and location.
 *
 * @property id - The unique identifier of the merchant to update.
 */
export interface MerchantUpdateRequest extends MerchantCreateRequest {
  id: number;
}

/**
 * A single raw transaction description linked to a merchant -- captured automatically whenever
 * the user assigns that merchant to a transaction, or added directly here.
 *
 * @property id - The unique identifier for the link.
 * @property merchantId - The merchant this description is linked to.
 * @property description - The raw description text, as linked.
 */
export interface MerchantDescriptionLink {
  id: number;
  merchantId: number;
  description: string;
}

/**
 * What linking descriptions to a merchant did: links created or moved, and existing transactions
 * with no merchant that got it. Sent back as is to undo the link.
 */
export type DescriptionLinkResult = components['schemas']['DescriptionLinkResultDto'];

/**
 * One distinct transaction description in the user's history, as offered by the description
 * picker. Descriptions differing only in case or spacing are one row.
 *
 * @property description - The most common raw spelling.
 * @property transactionCount - How many of the user's transactions use it.
 * @property merchantId - The merchant it is linked to, or null when unlinked.
 * @property merchantName - That merchant's name, or null when unlinked.
 */
export interface TransactionDescription {
  description: string;
  transactionCount: number;
  merchantId: number | null;
  merchantName: string | null;
}

/**
 * One group of description variants that look like the same merchant (case, spacing, store
 * numbers and similar noise removed), as listed by the Unlinked tab.
 *
 * @property key - The normalised text the variants share; stable across loads.
 * @property displayName - A readable name for the group, taken from its most common variant.
 * @property variantCount - How many distinct raw descriptions are in the group.
 * @property transactionCount - How many transactions use any of those descriptions.
 * @property variants - The raw descriptions in the group, most used first.
 * @property similarKeys - Keys of other groups whose names look alike (a hint, never merged).
 */
export interface DescriptionGroup {
  key: string;
  displayName: string;
  variantCount: number;
  transactionCount: number;
  variants: TransactionDescription[];
  similarKeys: string[];
}

/**
 * A page of description groups, plus how many descriptions in all are still unlinked.
 *
 * @property content - The groups on this page.
 * @property page - Page number, size and totals.
 * @property unlinkedDescriptionCount - Distinct descriptions not linked to any merchant.
 */
export interface DescriptionGroupPage {
  content: DescriptionGroup[];
  page: { size: number; number: number; totalElements: number; totalPages: number };
  unlinkedDescriptionCount: number;
}

/**
 * The user's merchants ranked by how closely their names match one description group's name.
 *
 * @property name - The name that was asked about.
 * @property merchants - The closest merchants, best first.
 */
export interface MerchantSuggestion {
  name: string;
  merchants: Merchant[];
}
