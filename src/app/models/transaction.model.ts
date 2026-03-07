import {Merchant} from '@models/merchant.model';
import {Category} from '@models/category.model';
import {Account, BankName} from "./account.model";

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
 */
export interface Transaction {
  id: number;
  account: Account;
  category: Category;
  amount: number;
  date: Date;
  description: string;
  type: TransactionType;
  merchant: Merchant;
  postDate?: Date;
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
  ADJUSTMENT = 'ADJUSTMENT'
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
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
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
  date: Date;
  postDate: Date;
  description: string;
  amount: number;
  type: TransactionType;
  suggestedCategory: Category;
  suggestedMerchant: Merchant;
}

/**
 * Represents a transaction data object for CSV import.
 *
 * @property date - The date of the transaction.
 * @property postDate - The date of posting the transaction.
 * @property type - The type of the transaction.
 * @property account - The ID of the account associated with the transaction.
 * @property amount - The amount of the transaction.
 * @property description - The description of the transaction.
 * @property vendorName - The name of the vendor associated with the transaction.
 * @property categoryName - The name of the category associated with the transaction.
 *
 * todo: remove, if not used
 */
export interface CsvTransactionData {
  date: string;
  postDate?: string;
  type: TransactionType;
  account: number;
  amount: number;
  description?: string;
  vendorName?: string;
  categoryName?: string;
}

/**
 * Represents a request to save transactions from a CSV file.
 *
 * @property transactions - The list of transactions to save.
 * @property fileName - The name of the CSV file.
 * @property fileHash - The hash of the CSV file.
 *
 * todo: change transaction type to TransactionCreateRequest[]
 */
export interface SaveTransactionRequest {
  transactions: CsvTransactionData[];
  fileName: string;
  fileHash: string;
}

/**
 * Represents a request to create a new transaction.
 *
 * @property accountId - The ID of the account associated with the transaction.
 * @property amount - The amount of the transaction.
 * @property transactionDate - The date of the transaction.
 * @property description - The description of the transaction.
 * @property type - The type of the transaction (income, expense, transfer, etc.).
 * @property categoryId - The ID of the category associated with the transaction.
 * @property postDate - The date of posting the transaction.
 * @property merchantId - The ID of the merchant associated with the transaction.
 */
export interface TransactionCreateRequest {
  accountId: number;
  amount: number;
  transactionDate: string;
  description: string;
  type: string;
  categoryId: number;
  postDate: string;
  merchantId: number;
}

/**
 * Represents a request to update an existing transaction.
 *
 * @property id - The ID of the transaction to update.
 * @property accountId - The ID of the account associated with the transaction.
 * @property amount - The new amount of the transaction.
 * @property transactionDate - The new date of the transaction.
 * @property description - The new description of the transaction.
 * @property type - The new type of the transaction (income, expense, transfer, etc.).
 * @property categoryId - The new ID of the category associated with the transaction.
 * @property postDate - The new date of posting the transaction.
 * @property merchantId - The new ID of the merchant associated with the transaction.
 */
export interface TransactionUpdateRequest {
  id: number;
  accountId: number;
  amount: number;
  transactionDate: string;
  description: string;
  type: string;
  categoryId: number;
  postDate: string;
  merchantId: number;
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
