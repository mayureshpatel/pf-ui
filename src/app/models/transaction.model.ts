import {Merchant} from '@models/merchant.model';
import {Category} from '@models/category.model';
import { Account } from "./account.model";

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
  vendorName?: string;
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

export interface TransferSuggestion {
  sourceTransaction: Transaction;
  targetTransaction: Transaction;
  confidenceScore: number;
}

// CSV Import Models
export interface TransactionPreview {
  date: string; // LocalDate from backend
  postDate?: string; // LocalDate from backend
  description: string;
  amount: number;
  type: TransactionType;
  suggestedCategory: string | null;
  vendorName: string | null;
}

export interface SaveTransactionRequest {
  transactions: Transaction[];
  fileName: string;
  fileHash: string;
}

export enum BankName {
  CAPITAL_ONE = 'CAPITAL_ONE',
  DISCOVER = 'DISCOVER',
  SYNOVUS = 'SYNOVUS',
  STANDARD = 'STANDARD',
  UNIVERSAL = 'UNIVERSAL'
}

export interface BankOption {
  label: string;
  value: BankName;
  description: string;
}
