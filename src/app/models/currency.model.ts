/**
 * Represents a currency object.
 *
 * @property code - The ISO 4217 currency code.
 * @property name - The full name of the currency.
 * @property symbol - The currency symbol.
 * @property isActive - Indicates if the currency is currently active.
 */
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  isActive: boolean;
}
