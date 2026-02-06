import { AccountType, AccountTypeInfo } from '@models/account.model';

export const ACCOUNT_TYPE_INFO: Record<AccountType, AccountTypeInfo> = {
  [AccountType.CHECKING]: {
    icon: 'pi-building',
    color: 'text-blue-500',
    label: 'Checking'
  },
  [AccountType.SAVINGS]: {
    icon: 'pi-money-bill',
    color: 'text-green-500',
    label: 'Savings'
  },
  [AccountType.CREDIT_CARD]: {
    icon: 'pi-credit-card',
    color: 'text-orange-500',
    label: 'Credit Card'
  },
  [AccountType.INVESTMENT]: {
    icon: 'pi-chart-line',
    color: 'text-purple-500',
    label: 'Investment'
  },
  [AccountType.CASH]: {
    icon: 'pi-wallet',
    color: 'text-gray-500',
    label: 'Cash'
  }
};

export function isLiabilityAccount(type: AccountType): boolean {
  return type === AccountType.CREDIT_CARD;
}

export function isAssetAccount(type: AccountType): boolean {
  return !isLiabilityAccount(type);
}
