import { Account, AccountType, BankName } from '@models/account.model';
import { accountTotals, bankLabel, groupAccounts, toCents } from './account-totals';

function type(isAsset: boolean, sortOrder = 1): AccountType {
  return {
    code: isAsset ? 'CHECKING' : 'CREDIT',
    label: 'X',
    isAsset,
    sortOrder,
    isActive: true,
    icon: 'pi-wallet',
    color: '',
  };
}
function account(
  id: number,
  name: string,
  balance: number,
  t: AccountType,
  bank: BankName | null = null,
): Account {
  return { id, name, currentBalance: balance, type: t, bank, version: 1 } as unknown as Account;
}

describe('account-totals', () => {
  describe('toCents', () => {
    it('should remove floating point noise', () => {
      // assert & verify
      expect(toCents(0.1 + 0.2)).toBe(0.3);
      expect(toCents(4820.149999999)).toBe(4820.15);
    });
  });

  describe('accountTotals', () => {
    it('should be zero for no accounts', () => {
      // assert & verify
      expect(accountTotals([])).toEqual({ assets: 0, liabilities: 0, netWorth: 0 });
    });

    it('should sum assets and treat liabilities as absolute values', () => {
      // arrange
      const accounts = [
        account(1, 'Checking', 4820.15, type(true)),
        account(2, 'Savings', 18200, type(true)),
        account(3, 'Visa', -1240.33, type(false)),
        account(4, 'Discover', -612.7, type(false)),
      ];

      // act
      const totals = accountTotals(accounts);

      // assert & verify
      expect(totals).toEqual({ assets: 23020.15, liabilities: 1853.03, netWorth: 21167.12 });
    });

    it('should go negative when liabilities exceed assets', () => {
      // assert & verify
      expect(
        accountTotals([account(1, 'A', 100, type(true)), account(2, 'B', -500, type(false))])
          .netWorth,
      ).toBe(-400);
    });
  });

  describe('groupAccounts', () => {
    it('should put Assets before Liabilities and omit an empty group', () => {
      // arrange
      const accounts = [
        account(3, 'Visa', -50, type(false)),
        account(1, 'Checking', 10, type(true)),
      ];

      // assert & verify
      expect(groupAccounts(accounts).map((g) => g.key)).toEqual(['ASSETS', 'LIABILITIES']);
      expect(groupAccounts([account(1, 'Checking', 10, type(true))]).map((g) => g.key)).toEqual([
        'ASSETS',
      ]);
      expect(groupAccounts([])).toEqual([]);
    });

    it('should order by type sort order, then name, then id, and keep same-named accounts distinct', () => {
      // arrange
      const accounts = [
        account(5, 'savings', 1, type(true, 2)),
        account(2, 'Checking', 1, type(true, 1)),
        account(4, 'checking', 1, type(true, 1)),
        account(3, 'Checking', 1, type(true, 1)),
      ];

      // act
      const ids = groupAccounts(accounts)[0].accounts.map((a) => a.id);

      // assert & verify
      expect(ids).toEqual([2, 3, 4, 5]);
    });

    it('should subtotal each group with the plain sum of its balances, in cents', () => {
      // arrange
      const accounts = [
        account(1, 'A', 0.1, type(true)),
        account(2, 'B', 0.2, type(true)),
        account(3, 'C', -1240.33, type(false)),
        account(4, 'D', -612.7, type(false)),
      ];

      // act
      const [assets, liabilities] = groupAccounts(accounts);

      // assert & verify
      expect(assets.subtotal).toBe(0.3);
      expect(liabilities.subtotal).toBe(-1853.03);
    });

    it('should keep a liability with a positive balance in Liabilities and show the honest subtotal', () => {
      // arrange
      const accounts = [
        account(1, 'Overpaid card', 25, type(false)),
        account(2, 'Other card', -100, type(false)),
      ];

      // assert & verify
      expect(groupAccounts(accounts)[0].subtotal).toBe(-75);
    });
  });

  describe('bankLabel', () => {
    it('should label every bank and return nothing for none', () => {
      // assert & verify
      expect(bankLabel(BankName.CAPITAL_ONE)).toBe('Capital One');
      expect(bankLabel(BankName.STANDARD)).toBe('Standard CSV');
      expect(bankLabel(null)).toBe('');
      expect(bankLabel(undefined)).toBe('');
    });
  });
});
