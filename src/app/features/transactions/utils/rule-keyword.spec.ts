import { describe, expect, it } from 'vitest';
import { sharedKeyword, singleKeyword, trimmedKeyword } from './rule-keyword';

describe('singleKeyword', () => {
  it('should leave a description without commas as it is', () => {
    expect(singleKeyword('NETFLIX.COM 866-579')).toBe('NETFLIX.COM 866-579');
  });

  it('should take the longest comma-separated part, trimmed, when there are commas', () => {
    expect(singleKeyword('PAYPAL *ACME, SAN JOSE CA')).toBe('PAYPAL *ACME');
  });
});

describe('trimmedKeyword (PF-929)', () => {
  const table: [string, string, string][] = [
    // [why, description, keyword]
    ['stops at a store number and drops the location', 'TACO BELL 041246 ROSWELL GA', 'TACO BELL'],
    ['stops at a zip code', 'ALDI 76012 WARNER ROBIN GA', 'ALDI'],
    [
      'cuts a reference glued to a word with a star',
      'AMAZON PRIME*DV0OW5RJ3 AMZN.COM/BILLWA4G2BDQOLAO8',
      'AMAZON PRIME',
    ],
    ['keeps a star when the word has no digit', 'HLU*HULU 837478479736-', 'HLU*HULU'],
    [
      'keeps CO, which is more likely "company" than Colorado',
      'TST* COW PIES PIZZA CO',
      'TST* COW PIES PIZZA CO',
    ],
    [
      'cuts a marketplace reference',
      'AMZN MKTP US*HT5292VU0 AMZN.COM/BILLWA5B8ZVMTFP61',
      'AMZN MKTP US',
    ],
    ['stops at a phone number', 'NETFLIX.COM 866-579', 'NETFLIX.COM'],
    ['drops a trailing city and state', 'ALPHARETTA ST BOTTLE ROSWELL GA', 'ALPHARETTA ST BOTTLE'],
    ['drops a trailing city and state after two words', 'SHELL OIL ATLANTA GA', 'SHELL OIL'],
    ['keeps a short description that only ends in a state', 'ATLANTA GA', 'ATLANTA GA'],
    ['keeps three words even when the last is a state', 'TACO BELL GA', 'TACO BELL GA'],
    ['keeps casing', 'Taco Bell 041246', 'Taco Bell'],
    ['ignores surrounding spaces', '  taco bell 12  ', 'taco bell'],
    [
      'leaves a description with nothing to trim',
      'Capital One Credit Card',
      'Capital One Credit Card',
    ],
    ['leaves stars and letters alone', 'PAYPAL *FAKE E MALE', 'PAYPAL *FAKE E MALE'],
    ['resolves commas first, then trims', 'PAYPAL *ACME, SAN JOSE CA', 'PAYPAL *ACME'],
    ['returns nothing for nothing', '', ''],
  ];

  it.each(table)('should %s: "%s"', (_why, description, expected) => {
    // act & assert & verify
    expect(trimmedKeyword(description)).toBe(expected);
  });

  const fallbacks: [string, string][] = [
    ['a description that starts with a number', '365 MARKET K 888 432-3'],
    ['a single word full of digits', '2116PEPSIVEN9147678600'],
    ['a trim that would leave fewer than 3 characters', 'GO 12345 FOO'],
  ];

  it.each(fallbacks)('should use the whole description for %s', (_why, description) => {
    // act & assert & verify
    expect(trimmedKeyword(description)).toBe(description);
  });

  it('should never return a comma', () => {
    // act & assert & verify
    expect(trimmedKeyword('ACME, INC 12, STORE 5')).not.toContain(',');
  });
});

describe('sharedKeyword (PF-930)', () => {
  const table: [string, string[], string][] = [
    [
      'the words every row shares, trimmed',
      ['TACO BELL 041246', 'TACO BELL 041246 ROSWELL', 'TACO BELL 0412'],
      'TACO BELL',
    ],
    ['ignoring case, with the first row casing', ['Taco Bell 12', 'TACO BELL 34'], 'Taco Bell'],
    ['nothing in common', ['NETFLIX.COM 866-579', 'SHELL OIL 57444'], ''],
    ['one description, trimmed like a single row', ['SHELL OIL 57444'], 'SHELL OIL'],
    ['a shared run shorter than 3 characters', ['A 1', 'A 2'], ''],
    [
      'a run that is not at the start of each description',
      ['PAYPAL *ACME STORE 12', 'SQ *ACME STORE 77'],
      '*ACME STORE',
    ],
    [
      'the longest run all rows share',
      ['A BIG STORE 1', 'A BIG STORE 2', 'BIG STORE 3'],
      'BIG STORE',
    ],
    ['only a number in common', ['STORE 1234', 'SHOP 1234'], ''],
    ['commas resolved to one part', ['ACME, INC 12', 'ACME, INC 99'], 'ACME'],
    ['an empty list', [], ''],
  ];

  it.each(table)('should give %s', (_why, descriptions, expected) => {
    // act & assert & verify
    expect(sharedKeyword(descriptions)).toBe(expected);
  });

  it('should never return a comma', () => {
    // act & assert & verify
    expect(sharedKeyword(['A, B 12', 'A, B 34'])).not.toContain(',');
  });
});
