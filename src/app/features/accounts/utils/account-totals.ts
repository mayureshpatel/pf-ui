import { Account, BankName } from '@models/account.model';

/** Rounds to whole cents so floating point noise never reaches a comparison or the screen. */
export const toCents = (value: number): number => Math.round(value * 100) / 100;

/** Net worth figures for the summary card. */
export interface AccountTotals {
  assets: number;
  liabilities: number;
  netWorth: number;
}

/**
 * Assets are the sum of balances of asset accounts; liabilities are the sum of the absolute
 * balances of the rest (the rule the old summary cards used); net worth is assets minus liabilities.
 *
 * @param accounts - Every account.
 */
export function accountTotals(accounts: Account[]): AccountTotals {
  let assets = 0;
  let liabilities = 0;
  for (const account of accounts) {
    if (account.type.isAsset) {
      assets += account.currentBalance;
    } else {
      liabilities += Math.abs(account.currentBalance);
    }
  }
  return {
    assets: toCents(assets),
    liabilities: toCents(liabilities),
    netWorth: toCents(assets - liabilities),
  };
}

/** One of the two groups on the page. */
export interface AccountGroup {
  key: 'ASSETS' | 'LIABILITIES';
  label: 'Assets' | 'Liabilities';
  subtotal: number;
  accounts: Account[];
}

const byDisplayOrder = (a: Account, b: Account): number =>
  a.type.sortOrder - b.type.sortOrder ||
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
  a.id - b.id;

/**
 * Splits accounts into Assets and Liabilities (empty groups omitted), each ordered by account type
 * sort order, then name, then id. The subtotal is the plain sum of the group's balances.
 *
 * @param accounts - Every account.
 */
export function groupAccounts(accounts: Account[]): AccountGroup[] {
  const build = (
    key: AccountGroup['key'],
    label: AccountGroup['label'],
    members: Account[],
  ): AccountGroup | null =>
    members.length === 0
      ? null
      : {
          key,
          label,
          subtotal: toCents(members.reduce((sum, a) => sum + a.currentBalance, 0)),
          accounts: [...members].sort(byDisplayOrder),
        };

  return [
    build(
      'ASSETS',
      'Assets',
      accounts.filter((a) => a.type.isAsset),
    ),
    build(
      'LIABILITIES',
      'Liabilities',
      accounts.filter((a) => !a.type.isAsset),
    ),
  ].filter((group): group is AccountGroup => group !== null);
}

const BANK_LABELS: Record<BankName, string> = {
  [BankName.CAPITAL_ONE]: 'Capital One',
  [BankName.DISCOVER]: 'Discover',
  [BankName.SYNOVUS]: 'Synovus',
  [BankName.STANDARD]: 'Standard CSV',
  [BankName.UNIVERSAL]: 'Universal CSV',
};

/**
 * The display name of a bank, or an empty string when the account has none.
 *
 * @param bank - The account's bank.
 */
export function bankLabel(bank: BankName | null | undefined): string {
  return bank ? (BANK_LABELS[bank] ?? '') : '';
}
