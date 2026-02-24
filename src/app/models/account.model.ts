import { BankName } from './transaction.model';
import {User} from '@models/auth.model';
import {Currency} from '@models/currency.model';
import {Iconography} from '@models/iconography.model';

export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  CREDIT_CARD = 'CREDIT_CARD',
  INVESTMENT = 'INVESTMENT',
  CASH = 'CASH'
}

export interface Account {
  id: number;
  user: User;
  name: string;
  type: AccountType;
  currentBalance: number;
  currency: Currency;
  bank: BankName;
}

export interface AccountFormData {
  name: string;
  type: AccountType;
  currentBalance: number;
  bankName?: BankName;
}

export interface AccountSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface AccountTypeInfo {
  label: string;
  iconography: Iconography;
}

export interface AccountSnapshot {
  id: number;
  account: Account;
  snapshotDate: Date;
  balance: number;
}
