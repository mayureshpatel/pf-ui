import { Merchant } from '@models/merchant.model';
import { Category } from '@models/category.model';
import { Account, BankName } from './account.model';
import { Tag } from '@models/tag.model';
import { components } from '../generated/api-types';

/**
 * Represents a transaction object.
 *
 * Maps directly to the Transaction entity in the database, without audit fields.
 *
 * @property id - The unique identifier of the transaction.
 * @property account - The {@link Account} associated with the transaction.
 * @property category - The {@link Category} associated with the transaction.
 * @property amount - The amount of the transaction.
 * @property date - The date of the transaction.
 * @property description - The description of the transaction.
 * @property type - The {@link TransactionType} of the transaction.
 * @property merchant - The {@link Merchant} associated with the transaction.
 * @property tags - The {@link Tag}s assigned to this transaction.
 */
export interface Transaction {
  id: number;
  account: Account;
  category: Category;
  amount: number;
  date: string;
  description: string;
  type: TransactionType;
  merchant: Merchant;
  postDate?: string;
  tags: Tag[];
}

/**
 * Represents a transaction type enum as defined in the backend.
 *
 * @enum {string}
 */
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  ADJUSTMENT = 'ADJUSTMENT',
}

/**
 * Represents a filter for transactions.
 *
 * @property accountId - The ID of the account to filter transactions by.
 * @property type - The type of transaction to filter by.
 * @property description - The description of the transaction to filter by.
 * @property categoryName - The name of the category to filter by.
 * @property merchant - The name of the merchant to filter by.
 * @property minAmount - The minimum amount of the transaction to filter by.
 * @property maxAmount - The maximum amount of the transaction to filter by.
 * @property startDate - The start date of the transaction to filter by.
 * @property endDate - The end date of the transaction to filter by.
 * @property tagId - The ID of the tag to filter by.
 */
export interface TransactionFilter {
  accountId?: number;
  type?: TransactionType;
  description?: string;
  categoryName?: string;
  merchant?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: Date;
  endDate?: Date;
  tagId?: number;
}

/**
 * Represents the state of the transaction ledger, including filter, pagination, and sorting.
 *
 * @property filter - The current transaction filter.
 * @property page - The current page number.
 * @property size - The number of items per page.
 * @property sort - The sorting criteria (e.g., "date,desc").
 */
export interface TransactionState {
  filter: TransactionFilter;
  page: number;
  size: number;
  sort: string;
}

/**
 * Represents a request for pagination.
 *
 * @property page - The page number to retrieve.
 * @property size - The number of items per page.
 * @property sort - The sorting criteria (e.g., "date,desc").
 */
export interface PageRequest {
  page: number;
  size: number;
  sort?: string; // e.g., "date,desc"
}

/**
 * Represents a response for pagination.
 *
 * @property content - The list of items on the current page.
 * @property totalElements - The total number of items.
 * @property totalPages - The total number of pages.
 * @property number - The current page number.
 * @property size - The number of items per page.
 * @property first - Indicates if this is the first page.
 * @property last - Indicates if this is the last page.
 * @template T - The type of the items in the response.
 */
export interface PageResponse<T> {
  content: T[];
  page: {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
  };
}

/**
 * Represents a suggestion for a transfer between two transactions.
 *
 * @property sourceTransaction - The transaction to be transferred from.
 * @property targetTransaction - The transaction to be transferred to.
 * @property confidenceScore - The confidence score of the suggestion.
 */
export interface TransferSuggestion {
  sourceTransaction: Transaction;
  targetTransaction: Transaction;
  confidenceScore: number;
}

/**
 * Represents a preview of changes made to a transaction.
 *
 * @property date - The date of the transaction.
 * @property postDate - The date of posting the transaction.
 * @property description - The description of the transaction.
 * @property amount - The amount of the transaction.
 * @property type - The type of the transaction.
 * @property suggestedCategory - The suggested category for the transaction.
 * @property suggestedMerchant - The suggested merchant for the transaction.
 */
export interface TransactionPreview {
  date: string;
  postDate: string;
  description: string;
  amount: number;
  type: TransactionType;
  suggestedCategory: Category;
  suggestedMerchant: Merchant;
}

/**
 * Represents a transaction DTO matching the backend TransactionDto structure.
 */
export interface TransactionDto {
  id?: number;
  account?: any;
  category?: Category | null;
  amount: number;
  date: string;
  description: string;
  type: TransactionType;
  postDate?: string | null;
  merchant?: Merchant | null;
}

/**
 * Represents a request to save transactions from a CSV file.
 */
export interface SaveTransactionRequest {
  transactions: TransactionDto[];
  fileName: string;
  fileHash: string;
  accountId: number;
}

/**
 * Represents a request to create a new transaction.
 *
 * Sourced from the backend's own OpenAPI schema (PF-317) rather than hand-maintained: `categoryId`,
 * `postDate`, and `merchantId` are genuinely optional on the backend (no `@NotNull` on any of the
 * three in `TransactionCreateRequest.java`), which the old hand-written version got wrong by
 * declaring them required.
 */
export type TransactionCreateRequest = components['schemas']['TransactionCreateRequest'];

/**
 * Represents a request to update an existing transaction.
 *
 * Sourced from the backend's own OpenAPI schema (PF-317) -- see {@link TransactionCreateRequest}'s
 * doc comment for why `categoryId`/`postDate`/`merchantId` are optional here too.
 */
export type TransactionUpdateRequest = components['schemas']['TransactionUpdateRequest'];

/**
 * Represents the payload emitted by {@link TransactionFormDrawerComponent} on save: the
 * transaction fields themselves, plus the full set of tag ids the user selected (not a diff --
 * the caller is responsible for comparing against the transaction's previous tags to decide what
 * to assign/remove).
 *
 * @property request - The transaction create/update payload.
 * @property tagIds - The complete set of tag ids the user selected in the form.
 */
export interface TransactionFormSaveEvent {
  request: TransactionCreateRequest | TransactionUpdateRequest;
  tagIds: number[];
}

/**
 * Represents a bank option for selecting a bank account.
 *
 * @property label - The label to display for the bank option.
 * @property value - The value of the bank option.
 * @property description - The description of the bank option.
 */
export interface BankOption {
  label: string;
  value: BankName;
  description: string;
}
