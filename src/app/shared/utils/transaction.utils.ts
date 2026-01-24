import { TransactionType, TransactionTypeInfo } from '@models/transaction.model';
import { formatCurrency } from './account.utils';

export const TRANSACTION_TYPE_INFO: Record<TransactionType, TransactionTypeInfo> = {
  [TransactionType.INCOME]: {
    icon: 'pi-arrow-up-right',
    color: 'text-green-600',
    label: 'Income'
  },
  [TransactionType.EXPENSE]: {
    icon: 'pi-arrow-down-left',
    color: 'text-red-600',
    label: 'Expense'
  },
  [TransactionType.TRANSFER]: {
    icon: 'pi-arrows-h',
    color: 'text-blue-600',
    label: 'Transfer'
  }
};

export function getTransactionTypeInfo(type: TransactionType): TransactionTypeInfo {
  return TRANSACTION_TYPE_INFO[type];
}

export function formatTransactionAmount(amount: number, type: TransactionType): string {
  const formatted = formatCurrency(Math.abs(amount));

  switch (type) {
    case TransactionType.INCOME:
      return `+${formatted}`;
    case TransactionType.EXPENSE:
      return `-${formatted}`;
    case TransactionType.TRANSFER:
      return formatted;
  }
}

export function getAmountClass(type: TransactionType): string {
  return TRANSACTION_TYPE_INFO[type].color;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
