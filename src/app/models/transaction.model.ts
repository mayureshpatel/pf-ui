import {Merchant} from '@models/merchant.model';
import {Category} from '@models/category.model';
import {Account, BankName} from "./account.model";

export interface Transaction {
  id: number;
  date: string;
  postDate?: string;
  description: string | null;
  merchant: Merchant;
  amount: number;
  type: TransactionType;
  category: Category;
  account: Account;
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  ADJUSTMENT = 'ADJUSTMENT'
}

export interface TransactionFilter {
  accountId?: number;
  type?: TransactionType;
  description?: string;
  categoryName?: string;
  merchant?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
}

export interface PageRequest {
  page: number;
  size: number;
  sort?: string; // e.g., "date,desc"
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

export interface TransactionTypeInfo {
  icon: string;
  color: string;
  label: string;
}

export interface TransactionFormData {
  id?: number;
  date: string;
  type: TransactionType;
  account: number;
  amount: number;
  description?: string;
  merchant?: Merchant;
  category?: Category;
}

export interface TransferSuggestion {
  sourceTransaction: Transaction;
  targetTransaction: Transaction;
  confidenceScore: number;
}

export interface TransactionPreview {
  date: string;
  postDate?: string;
  description: string;
  amount: number;
  type: TransactionType;
  suggestedCategory: string | null;
  vendorName: string | null;
}

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

export interface SaveTransactionRequest {
  transactions: CsvTransactionData[];
  fileName: string;
  fileHash: string;
}

export interface BankOption {
  label: string;
  value: BankName;
  description: string;
}

export interface CategoryTransactionCount {
  category: Category;
  transactionCount: number;
}
