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
 */
export interface Merchant {
  id: number;
  userId: number;
  name: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
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
