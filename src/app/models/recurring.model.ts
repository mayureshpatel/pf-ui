export enum Frequency {
  WEEKLY = 'WEEKLY',
  BI_WEEKLY = 'BI_WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY'
}

export interface RecurringTransaction {
  id: number;
  accountId?: number;
  accountName?: string;
  merchantName: string;
  amount: number;
  frequency: Frequency;
  lastDate?: string;
  nextDate: string;
  active: boolean;
}

export interface RecurringTransactionDto {
  accountId?: number;
  merchantName: string;
  amount: number;
  frequency: Frequency;
  lastDate?: string;
  nextDate: string;
  active: boolean;
}

export interface RecurringSuggestion {
  merchantName: string;
  amount: number;
  frequency: Frequency;
  lastDate: string;
  nextDate: string;
  occurrenceCount: number;
  confidenceScore: number;
}
