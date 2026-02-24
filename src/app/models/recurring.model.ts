import {Merchant} from '@models/merchant.model';
import {User} from '@models/auth.model';
import {Account} from '@models/account.model';

export enum Frequency {
  WEEKLY = 'WEEKLY',
  BI_WEEKLY = 'BI_WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY'
}

export interface RecurringTransaction {
  id: number;
  user: User;
  merchant: Merchant;
  amount: number;
  frequency: Frequency;
  nextDate: string;
  active: boolean;
  account?: Account;
  lastDate?: string;
}

export interface RecurringSuggestion {
  merchant: Merchant;
  amount: number;
  frequency: Frequency;
  lastDate: string;
  nextDate: string;
  occurrenceCount: number;
  confidenceScore: number;
}
