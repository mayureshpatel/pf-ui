export interface Transaction {
  id: number;
  amount: number;
  date: string; // ISO date string
  description: string | null;
  originalVendorName: string | null;
  vendorName: string | null;
  type: TransactionType;
  categoryName: string | null;
  accountId: number;
  accountName?: string; // Will be populated from account data
  categoryIcon?: string; // UI Enrichment
  categoryColor?: string; // UI Enrichment
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT'
}

export interface TransactionFormData {
  id?: number;
  date: string;
  type: TransactionType;
  accountId: number;
  amount: number;
  description?: string;
  vendorName?: string;
  categoryName?: string;
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
  description: string;
  amount: number;
  type: TransactionType;
  suggestedCategory: string | null;
  vendorName: string | null;
}

export interface SaveTransactionRequest {
  transactions: TransactionFormData[];
  fileName: string;
  fileHash: string;
}

export enum BankName {
  CAPITAL_ONE = 'CAPITAL_ONE',
  DISCOVER = 'DISCOVER',
  SYNOVUS = 'SYNOVUS',
  STANDARD = 'STANDARD'
}

export interface BankOption {
  label: string;
  value: BankName;
  description: string;
}
