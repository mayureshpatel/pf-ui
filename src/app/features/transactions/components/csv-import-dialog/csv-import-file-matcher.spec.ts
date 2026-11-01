import { Account, BankName } from '@models/account.model';
import { matchFile, parseStatementFileName } from './csv-import-file-matcher';

function account(id: number, bank: BankName): Account {
  return { id, bank } as Account;
}

describe('parseStatementFileName', () => {
  it('parses bank token, year and month', () => {
    expect(parseStatementFileName('capone-2026-01.csv')).toEqual({
      bankToken: 'capone',
      year: 2026,
      month: 1,
    });
  });

  it('accepts an upper-case extension', () => {
    expect(parseStatementFileName('discover-2026-02.CSV')?.month).toBe(2);
  });

  it.each(['statement.csv', 'synovus-2026-13.csv', 'synovus-2026-00.csv', 'synovus-2026-01.txt'])(
    'rejects %s',
    (name: string) => {
      expect(parseStatementFileName(name)).toBeNull();
    },
  );
});

describe('matchFile', () => {
  const accounts: Account[] = [
    account(1, BankName.CAPITAL_ONE),
    account(2, BankName.DISCOVER),
    account(3, BankName.SYNOVUS),
  ];

  it('matches capone-2026-01.csv to the Capital One account', () => {
    expect(matchFile('capone-2026-01.csv', accounts)).toEqual({
      bankName: BankName.CAPITAL_ONE,
      accountId: 1,
      statementMonth: '2026-01',
      reason: 'matched',
    });
  });

  it('accepts the capitalone and enum-style aliases', () => {
    expect(matchFile('capitalone-2026-03.csv', accounts).bankName).toBe(BankName.CAPITAL_ONE);
    expect(matchFile('Capital-One-2026-03.csv', accounts).bankName).toBe(BankName.CAPITAL_ONE);
    expect(matchFile('CAPITAL_ONE-2026-03.csv', accounts).bankName).toBe(BankName.CAPITAL_ONE);
    expect(matchFile('standard-2026-03.csv', accounts).bankName).toBe(BankName.STANDARD);
  });

  it('matches case-insensitively including the extension', () => {
    const result = matchFile('discover-2026-02.CSV', accounts);
    expect(result.accountId).toBe(2);
    expect(result.statementMonth).toBe('2026-02');
    expect(result.reason).toBe('matched');
  });

  it('does not guess on a typo', () => {
    expect(matchFile('Synvous-2026-07.csv', accounts)).toEqual({
      bankName: null,
      accountId: null,
      statementMonth: null,
      reason: 'unrecognised-name',
    });
  });

  it.each(['synovus-2026-13.csv', 'statement.csv'])('flags %s as unrecognised', (name: string) => {
    const result = matchFile(name, accounts);
    expect(result.reason).toBe('unrecognised-name');
    expect(result.accountId).toBeNull();
  });

  it('reports multiple-accounts without choosing one', () => {
    const result = matchFile('discover-2026-02.csv', [
      account(2, BankName.DISCOVER),
      account(9, BankName.DISCOVER),
    ]);
    expect(result).toEqual({
      bankName: BankName.DISCOVER,
      accountId: null,
      statementMonth: '2026-02',
      reason: 'multiple-accounts',
    });
  });

  it('reports no-account but keeps the bank', () => {
    const result = matchFile('synovus-2026-07.csv', [account(1, BankName.DISCOVER)]);
    expect(result).toEqual({
      bankName: BankName.SYNOVUS,
      accountId: null,
      statementMonth: '2026-07',
      reason: 'no-account',
    });
  });
});
