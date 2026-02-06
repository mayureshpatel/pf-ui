import {Pipe, PipeTransform} from '@angular/core';
import {AccountType} from '@models/account.model';

export interface AccountTypeInfo {
  label: string;
  icon: string;
  color: string;
}

@Pipe({name: 'accountTypeInfo'})
export class AccountTypeInfoPipe implements PipeTransform {
  transform(type: AccountType): AccountTypeInfo;
  transform(type: AccountType, property: 'label'): string;
  transform(type: AccountType, property: 'icon'): string;
  transform(type: AccountType, property: 'color'): string;
  transform(type: AccountType, property?: keyof AccountTypeInfo): AccountTypeInfo | string {
    const info: AccountTypeInfo = this.getAccountTypeInfo(type);

    if (property) {
      return info[property];
    }

    return info;
  }

  private getAccountTypeInfo(type: AccountType): AccountTypeInfo {
    const typeMap: Record<AccountType, AccountTypeInfo> = {
      [AccountType.CHECKING]: {
        label: 'Checking',
        icon: 'pi-wallet',
        color: 'text-blue-600'
      },
      [AccountType.SAVINGS]: {
        label: 'Savings',
        icon: 'pi-piggy-bank',
        color: 'text-green-600'
      },
      [AccountType.CREDIT_CARD]: {
        label: 'Credit Card',
        icon: 'pi-credit-card',
        color: 'text-purple-600'
      },
      [AccountType.INVESTMENT]: {
        label: 'Investment',
        icon: 'pi-chart-line',
        color: 'text-orange-600'
      },
      [AccountType.CASH]: {
        label: 'Cash',
        icon: 'pi-money-bill',
        color: 'text-gray-600'
      }
    };

    return typeMap[type] || {
      label: 'Unknown',
      icon: 'pi-question-circle',
      color: 'text-gray-400'
    }
  }
}
