export type RecurringFrequency = 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface RecurringAccount {
  id: number;
  name: string;
}

export interface RecurringMerchant {
  id: number;
  originalName: string;
  cleanName: string;
}

export interface RecurringTransaction {
  id: number;
  userId: number;
  account: RecurringAccount;
  merchant: RecurringMerchant;
  amount: number;
  frequency: RecurringFrequency;
  lastDate?: string;
  nextDate: string;
  active: boolean;
}

export interface RecurringSuggestion {
  merchant: RecurringMerchant;
  amount: number;
  frequency: RecurringFrequency;
  lastDate: string;
  nextDate: string;
  occurrenceCount: number;
  confidenceScore: number;
}

export interface RecurringRequest {
  userId: number;
  accountId: number;
  merchantId: number;
  amount: number;
  frequency: RecurringFrequency;
  nextDate: string;
  lastDate?: string;
  active: boolean;
}
