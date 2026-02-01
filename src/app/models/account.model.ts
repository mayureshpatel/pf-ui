import { BankName } from './transaction.model';

export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  CREDIT_CARD = 'CREDIT_CARD',
  INVESTMENT = 'INVESTMENT',
  CASH = 'CASH'
}

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  currentBalance: number;
  bankName?: BankName;
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
  icon: string;
  color: string;
  label: string;
}
