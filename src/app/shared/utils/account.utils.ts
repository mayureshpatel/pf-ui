import { AccountType, AccountTypeInfo } from '@models/account.model';

export const ACCOUNT_TYPE_INFO: Record<AccountType, AccountTypeInfo> = {
  [AccountType.CHECKING]: {
    label: 'Checking',
    iconography: {
      icon: 'pi-building',
      color: 'text-blue-500'
    }
  },
  [AccountType.SAVINGS]: {
    label: 'Savings',
    iconography: {
      icon: 'pi-money-bill',
      color: 'text-green-500'
    }
  },
  [AccountType.CREDIT_CARD]: {
    label: 'Credit Card',
    iconography: {
      icon: 'pi-credit-card',
      color: 'text-orange-500'
    }
  },
  [AccountType.INVESTMENT]: {
    label: 'Investment',
    iconography: {
      icon: 'pi-chart-line',
      color: 'text-purple-500'
    }
  },
  [AccountType.CASH]: {
    label: 'Cash',
    iconography: {
      icon: 'pi-wallet',
      color: 'text-gray-500'
    }
  }
};

export function isLiabilityAccount(type: AccountType): boolean {
  return type === AccountType.CREDIT_CARD;
}

export function isAssetAccount(type: AccountType): boolean {
  return !isLiabilityAccount(type);
}
