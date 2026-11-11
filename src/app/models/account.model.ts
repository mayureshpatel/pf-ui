import { User } from '@models/auth.model';
import { Currency } from '@models/currency.model';

/**
 * Represents an account object.
 *
 * Maps directly to the Account entity in the database, without audit fields.
 *
 * @property id - The unique identifier of the account.
 * @property user - The {@link User} associated with the account.
 * @property name - The name of the account.
 * @property type - The {@link AccountType} of the account.
 * @property currentBalance - The current balance of the account.
 * @property currency - The {@link Currency} of the account.
 * @property bank - The {@link BankName} associated with the account.
 * @property version - The version of the account for optimistic locking.
 * @property balanceMode - DERIVED when the balance comes from transactions, MANUAL when entered by hand.
 * @property moneyIn - What the user has put in; null unless MANUAL.
 * @property gain - Current balance minus money in; null unless MANUAL, or when no balance exists yet.
 */
export interface Account {
  id: number;
  user: User;
  name: string;
  type: AccountType;
  currentBalance: number;
  currency: Currency;
  bank: BankName;
  version: number;
  balanceMode: BalanceMode;
  moneyIn: number | null;
  gain: number | null;
}

/** Where an account's balance comes from. */
export type BalanceMode = 'DERIVED' | 'MANUAL';

/** The account type code for loans, which show only a remaining balance. */
export const LOAN_TYPE_CODE = 'LOAN';

/**
 * One recorded balance of a hand-entered account.
 *
 * @property id - The unique identifier of the entry.
 * @property account - The account the entry belongs to.
 * @property snapshotDate - The day the balance applies to (yyyy-MM-dd).
 * @property balance - The recorded balance.
 */
export interface AccountSnapshot {
  id: number;
  account: Account;
  snapshotDate: string;
  balance: number;
}

/**
 * Request payload for recording the balance of a hand-entered account.
 *
 * @property accountId - The account the balance is for.
 * @property balance - The balance to record.
 * @property asOfDate - The day the balance applies to (yyyy-MM-dd).
 * @property version - The version of the account for optimistic locking.
 */
export interface BalanceEntryRequest {
  accountId: number;
  balance: number;
  asOfDate: string;
  version: number;
}

/**
 * Represents the request payload for creating a new account.
 *
 * @property name - The name of the account.
 * @property type - The type of the account.
 * @property startingBalance - The starting balance of the account.
 * @property currencyCode - The currency code of the account.
 * @property bankName - The bank name of the account.
 */
export interface AccountCreateRequest {
  name: string;
  type: string;
  startingBalance: number;
  currencyCode: string;
  bankName: string | null;
  balanceMode?: BalanceMode;
}

/**
 * Represents the request payload for updating an existing account.
 *
 * @property id - The unique identifier of the account.
 * @property name - The updated name of the account.
 * @property type - The updated type of the account.
 * @property currencyCode - The updated currency code of the account.
 * @property bankName - The updated bank name of the account.
 * @property version - The version of the account for optimistic locking.
 */
export interface AccountUpdateRequest {
  id: number;
  name: string;
  type: string;
  currencyCode: string;
  bankName: string | null;
  version: number;
  balanceMode?: BalanceMode;
}

/**
 * Represents the request payload for reconciling an account.
 *
 * @property accountId - The unique identifier of the account.
 * @property newBalance - The new balance to reconcile the account to.
 * @property version - The version of the account for optimistic locking.
 */
export interface AccountReconcileRequest {
  accountId: number;
  newBalance: number;
  version: number;
}

/**
 * Represents the account type.
 *
 * Maps directly to the AccountType entity in the database, without audit fields.
 *
 * @property code - The unique code of the account type.
 * @property label - The human-readable label of the account type.
 * @property isAsset - Indicates if the account type represents an asset.
 * @property sortOrder - The sort order for displaying account types.
 * @property isActive - Indicates if the account type is currently active.
 * @property icon - The icon associated with the account type.
 * @property color - The color associated with the account type.
 */
export interface AccountType {
  code: string;
  label: string;
  isAsset: boolean;
  sortOrder: number;
  isActive: boolean;
  icon: string;
  color: string;
}

/**
 * Represents the request payload for creating a new account type.
 *
 * @property code - The unique code of the account type.
 * @property label - The human-readable label of the account type.
 * @property icon - The icon associated with the account type.
 * @property color - The color associated with the account type.
 * @property isAsset - Indicates if the account type represents an asset.
 * @property sortOrder - The sort order for displaying account types.
 * @property isActive - Indicates if the account type is currently active.
 */
export interface AccountTypeCreateRequest {
  code: string;
  label: string;
  icon: string;
  color: string;
  isAsset: boolean;
  sortOrder: number;
  isActive: boolean;
}

/**
 * Represents a bank name enum as is defined in the backend.
 */
export enum BankName {
  CAPITAL_ONE = 'CAPITAL_ONE',
  DISCOVER = 'DISCOVER',
  SYNOVUS = 'SYNOVUS',
  ALLY = 'ALLY',
  FIDELITY_RETIREMENT = 'FIDELITY_RETIREMENT',
  FIDELITY_BROKERAGE = 'FIDELITY_BROKERAGE',
  STANDARD = 'STANDARD',
  UNIVERSAL = 'UNIVERSAL',
}

/**
 * Represents a summary of all accounts.
 *
 * @property totalAssets - The total value of all asset accounts.
 * @property totalLiabilities - The total value of all liability accounts.
 * @property netWorth - The net worth (total assets minus total liabilities).
 */
export interface AccountSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}
