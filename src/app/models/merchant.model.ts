/**
 * Represents a merchant entity.
 *
 * Maps directly to the Merchant entity in the database, without audit fields.
 *
 * @property id - The unique identifier for the merchant.
 * @property userId - The user ID associated with the merchant.
 * @property originalName - The original name of the merchant.
 * @property cleanName - The cleaned name of the merchant.
 */
export interface Merchant {
  id: number;
  userId: number;
  originalName: string;
  cleanName: string;
}

/**
 * Represents a request to update a merchant's clean name.
 *
 * @property id - The unique identifier of the merchant to update.
 * @property cleanName - The new clean name for the merchant.
 */
export interface MerchantUpdateRequest {
  id: number;
  cleanName: string;
}

/**
 * Represents a request to create a new merchant.
 *
 * @property userId - The user ID associated with the merchant.
 * @property originalName - The original name of the merchant.
 * @property cleanName - The cleaned name of the merchant.
 */
export interface MerchantCreateRequest {
  userId: number;
  originalName: string;
  cleanName: string;
}
