import { Account, BankName } from '@models/account.model';

export interface ParsedStatementFileName {
  bankToken: string;
  year: number;
  month: number;
}

export type FileMatchReason = 'matched' | 'multiple-accounts' | 'no-account' | 'unrecognised-name';

export interface FileMatch {
  bankName: BankName | null;
  accountId: number | null;
  statementMonth: string | null;
  reason: FileMatchReason;
}

const FILE_NAME_PATTERN = /^(.+)-(\d{4})-(\d{2})\.csv$/i;

/** Normalised (lower-case, alphanumeric only) bank token -> bank. Exact matches only. */
const BANK_ALIASES: Readonly<Record<string, BankName>> = {
  capone: BankName.CAPITAL_ONE,
  capitalone: BankName.CAPITAL_ONE,
  discover: BankName.DISCOVER,
  synovus: BankName.SYNOVUS,
  standard: BankName.STANDARD,
  universal: BankName.UNIVERSAL,
};

function normalise(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Parses `<bank-name>-YYYY-MM.csv`; returns null when the name does not fit. */
export function parseStatementFileName(fileName: string): ParsedStatementFileName | null {
  const parts: RegExpExecArray | null = FILE_NAME_PATTERN.exec(fileName);
  if (!parts) return null;
  const month: number = Number(parts[3]);
  if (month < 1 || month > 12) return null;
  return { bankToken: parts[1], year: Number(parts[2]), month };
}

/** Infers bank, account and statement month from a file name. No fuzzy matching. */
export function matchFile(fileName: string, accounts: Account[]): FileMatch {
  const parsed: ParsedStatementFileName | null = parseStatementFileName(fileName);
  const bankName: BankName | undefined = parsed
    ? BANK_ALIASES[normalise(parsed.bankToken)]
    : undefined;
  if (!parsed || !bankName) {
    return { bankName: null, accountId: null, statementMonth: null, reason: 'unrecognised-name' };
  }

  const statementMonth = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
  const candidates: Account[] = accounts.filter((a: Account): boolean => a.bank === bankName);

  if (candidates.length === 1) {
    return { bankName, accountId: candidates[0].id, statementMonth, reason: 'matched' };
  }
  return {
    bankName,
    accountId: null,
    statementMonth,
    reason: candidates.length === 0 ? 'no-account' : 'multiple-accounts',
  };
}
