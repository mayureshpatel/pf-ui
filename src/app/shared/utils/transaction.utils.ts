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
  },
  [TransactionType.TRANSFER_IN]: {
    icon: 'pi-arrow-left',
    color: 'text-blue-600',
    label: 'Transfer In'
  },
  [TransactionType.TRANSFER_OUT]: {
    icon: 'pi-arrow-right',
    color: 'text-blue-600',
    label: 'Transfer Out'
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
    case TransactionType.TRANSFER_OUT:
      return `-${formatted}`; // Visually negative for outgoing
    case TransactionType.TRANSFER_IN:
      return `+${formatted}`; // Visually positive for incoming
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
