import { Merchant } from '@models/merchant.model';
import { Account } from '@models/account.model';

/**
 * Represents the frequency at which recurring transactions occur.
 *
 * Maps directly to the Frequency enum in the backend.
 *
 * @enum {string}
 */
export type RecurringFrequency = 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

/**
 * Represents a recurring transaction.
 *
 * Maps directly to the RecurringTransaction entity in the database, without audit fields.
 *
 * @property id - The unique identifier of the recurring transaction.
 * @property userId - The ID of the user associated with the recurring transaction.
 * @property account - The account associated with the recurring transaction.
 * @property merchant - The merchant associated with the recurring transaction.
 * @property amount - The amount of the recurring transaction.
 * @property frequency - The frequency of the recurring transaction.
 * @property nextDate - The next date of the recurring transaction.
 * @property active - Indicates if the recurring transaction is active.
 */
export interface RecurringTransaction {
  id: number;
  userId: number;
  account: Account;
  merchant: Merchant;
  amount: number;
  frequency: RecurringFrequency;
  nextDate: string;
  active: boolean;
  lastDate?: string;
  /** The newest real charge matched to this item (by merchant or linked description). */
  lastChargeDate?: string | null;
  lastChargeAmount?: number | null;
  /** Where the next charge is expected, rolled forward from the last real charge. */
  projectedNextDate?: string | null;
  /** True when that expected date has already passed. */
  overdue?: boolean;
  /** Set when the newest real charge no longer costs what is stored. */
  priceChange?: PriceChange | null;
}

/** A tracked item whose real charges differ from its stored amount. */
export interface PriceChange {
  previousAmount: number;
  newAmount: number;
  /** Date of the first charge in the unbroken run at the new amount. */
  since: string;
}

/** A recurring pattern the user dismissed from the review. */
export interface DismissedPattern {
  id: number;
  patternKey: string;
  name: string;
  dismissedAt: string;
}

/**
 * Represents a recurring transaction suggestion.
 *
 * @property merchant - The merchant associated with the suggestion.
 * @property amount - The amount of the transaction.
 * @property frequency - The frequency of the transaction.
 * @property lastDate - The last date of the transaction.
 * @property nextDate - The next date of the transaction.
 * @property occurrenceCount - The number of occurrences of the transaction.
 * @property confidenceScore - The confidence score of the suggestion.
 */
export interface RecurringSuggestion {
  merchant: Merchant;
  amount: number;
  frequency: RecurringFrequency;
  lastDate: string;
  nextDate: string;
  occurrenceCount: number;
  confidenceScore: number;
  /** The account the pattern's newest charge came from. */
  accountId?: number | null;
  accountName?: string | null;
  /** The price before the latest unbroken run at the current amount, when it changed. */
  previousAmount?: number | null;
  priceChangedOn?: string | null;
  /** The detected name folded the way description links fold text; the dismissal key. */
  patternKey: string;
  /** The merchant this pattern's text is already linked to, when there is one. */
  linkedMerchantId?: number | null;
  linkedMerchantName?: string | null;
}

/**
 * Represents a request to create a new recurring transaction.
 *
 * @property userId - The ID of the user creating the recurring transaction.
 * @property accountId - The ID of the account associated with the recurring transaction.
 * @property merchantId - The ID of the merchant associated with the recurring transaction.
 * @property amount - The amount of the recurring transaction.
 * @property frequency - The frequency of the recurring transaction.
 * @property nextDate - The next date of the recurring transaction.
 * @property active - Indicates if the recurring transaction is active.
 * @property lastDate - The last date of the recurring transaction.
 */
export interface RecurringTransactionCreateRequest {
  userId: number;
  accountId: number;
  merchantId: number;
  amount: number;
  frequency: string;
  nextDate: string;
  active: boolean;
  lastDate?: string;
}

/**
 * Represents a request to update an existing recurring transaction.
 *
 * @property id - The ID of the recurring transaction to update.
 * @property accountId - The ID of the account associated with the recurring transaction.
 * @property merchantId - The ID of the merchant associated with the recurring transaction.
 * @property amount - The amount of the recurring transaction.
 * @property frequency - The frequency of the recurring transaction.
 * @property nextDate - The next date of the recurring transaction.
 * @property active - Indicates if the recurring transaction is active.
 * @property lastDate - The last date of the recurring transaction.
 */
export interface RecurringTransactionUpdateRequest {
  id: number;
  accountId: number;
  merchantId: number;
  amount: number;
  frequency: string;
  nextDate: string;
  active: boolean;
}
