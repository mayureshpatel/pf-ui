import {User} from '@models/auth.model';
import {Currency} from '@models/currency.model';

export interface Account {
  id: number;
  user: User;
  name: string;
  type: AccountType;
  currentBalance: number;
  currency: Currency;
  bank: BankName;
  version?: number;
}

export interface AccountFormData {
  accountName: string;
  accountType: AccountType | null;
  currentBalance: number;
  bankName: BankName | null;
}

export interface AccountType {
  code: string;
  label: string;
  isAsset: boolean;
  sortOrder: number;
  isActive: boolean;
  icon: string | null;
  color: string | null;
}

export enum BankName {
  CAPITAL_ONE = 'CAPITAL_ONE',
  DISCOVER = 'DISCOVER',
  SYNOVUS = 'SYNOVUS',
  STANDARD = 'STANDARD',
  UNIVERSAL = 'UNIVERSAL'
}

export interface AccountSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface AccountSnapshot {
  id: number;
  account: Account;
  snapshotDate: Date;
  balance: number;
}
