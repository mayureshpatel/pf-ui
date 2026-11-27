import { vi } from 'vitest';
import { firstValueFrom, of, throwError } from 'rxjs';
import { DescriptionLinkResult, LookAlikeWarning, Merchant } from '@models/merchant.model';
import { MerchantApiService } from '../services/merchant-api.service';
import {
  LastLink,
  lastLinkOf,
  lastLinkText,
  LinkOutcome,
  linkInBatches,
  undoLink,
  undoneText,
  warnedDescriptions,
  warningText,
} from './link-helpers';

const result = (linkedCount: number, transactionsFilled: number): DescriptionLinkResult => ({
  merchantId: 4,
  linkedCount,
  movedCount: 0,
  transactionsFilled,
  linkChanges: [],
  filledTransactionIds: [],
});
const merchant = (id: number, name: string): Merchant => ({
  id,
  userId: 1,
  name,
  city: null,
  state: null,
  postalCode: null,
  country: null,
});
const warning = (over: Partial<LookAlikeWarning> = {}): LookAlikeWarning => ({
  groupName: 'KROGER FUEL CTR',
  words: ['FUEL'],
  descriptions: [
    'KROGER FUEL CTR #1',
    'KROGER FUEL CTR #2',
    'KROGER FUEL CTR #3',
    'KROGER FUEL #4',
  ],
  merchants: [merchant(5, 'Kroger Fuel Center')],
  nextToGroup: null,
  ...over,
});

describe('link-helpers', () => {
  describe('linkInBatches', () => {
    it('should send at most 500 per request and carry on past a failed one', async () => {
      // arrange
      const api = {
        addDescriptionLinks: vi
          .fn()
          .mockImplementation((_id: number, items: string[]) =>
            items.includes('BAD')
              ? throwError(() => ({ error: { detail: 'Too long.' } }))
              : of(result(items.length, 0)),
          ),
      } as unknown as MerchantApiService;
      const descriptions = [...Array.from({ length: 500 }, (_, i) => `D${i}`), 'BAD'];

      // act
      const outcomes: LinkOutcome[] = await firstValueFrom(linkInBatches(api, 4, descriptions));

      // assert & verify
      expect(outcomes.map((o) => [o.items.length, o.ok, o.message])).toEqual([
        [500, true, ''],
        [1, false, 'Too long.'],
      ]);
    });
  });

  describe('lastLinkOf', () => {
    it('should sum the successful requests and skip the failed ones', () => {
      // act
      const link = lastLinkOf('Kroger', [
        { items: ['A'], ok: true, message: '', result: result(8, 200) },
        { items: ['B'], ok: false, message: 'x', result: null },
        { items: ['C'], ok: true, message: '', result: result(3, 5) },
      ]);

      // assert & verify
      expect(link).toEqual({
        merchantName: 'Kroger',
        linked: 11,
        filled: 205,
        results: [result(8, 200), result(3, 5)],
      });
    });

    it('should give nothing when no request succeeded', () => {
      // act & assert
      expect(lastLinkOf('Kroger', [{ items: ['A'], ok: false, message: 'x', result: null }])).toBe(
        null,
      );
    });
  });

  describe('undoLink', () => {
    const link: LastLink = {
      merchantName: 'Kroger',
      linked: 11,
      filled: 205,
      results: [result(8, 200), result(3, 5)],
    };

    it('should send every result back and sum what was restored and kept', async () => {
      // arrange
      const api = {
        undoDescriptionLinks: vi
          .fn()
          .mockReturnValueOnce(
            of({
              linksRestored: 8,
              linksSkipped: 0,
              transactionsRestored: 198,
              skippedTransactionIds: [1, 2],
            }),
          )
          .mockReturnValueOnce(
            of({
              linksRestored: 2,
              linksSkipped: 1,
              transactionsRestored: 5,
              skippedTransactionIds: [],
            }),
          ),
      } as unknown as MerchantApiService;

      // act
      const outcome = await firstValueFrom(undoLink(api, link));

      // assert & verify
      expect(api.undoDescriptionLinks).toHaveBeenCalledWith(link.results[0]);
      expect(api.undoDescriptionLinks).toHaveBeenCalledWith(link.results[1]);
      expect(outcome).toEqual({ restored: 213, skipped: 3, failed: false });
    });

    it('should report a failed request instead of throwing', async () => {
      // arrange
      const api = {
        undoDescriptionLinks: vi
          .fn()
          .mockReturnValueOnce(throwError(() => new Error('down')))
          .mockReturnValueOnce(
            of({
              linksRestored: 3,
              linksSkipped: 0,
              transactionsRestored: 5,
              skippedTransactionIds: [],
            }),
          ),
      } as unknown as MerchantApiService;

      // act
      const outcome = await firstValueFrom(undoLink(api, link));

      // assert & verify
      expect(outcome.failed).toBe(true);
      expect(api.undoDescriptionLinks).toHaveBeenCalledTimes(2);
    });
  });

  describe('the status line', () => {
    it('should name what was linked and filled', () => {
      // act & assert
      expect(lastLinkText({ merchantName: 'Kroger', linked: 11, filled: 205, results: [] })).toBe(
        'Linked 11 to Kroger · 205 transactions filled',
      );
      expect(lastLinkText({ merchantName: 'Kroger', linked: 1, filled: 1, results: [] })).toBe(
        'Linked 1 to Kroger · 1 transaction filled',
      );
      expect(lastLinkText({ merchantName: 'Kroger', linked: 2, filled: 0, results: [] })).toBe(
        'Linked 2 to Kroger · no transactions filled',
      );
    });

    it('should say what Undo did, and what it kept', () => {
      // act & assert
      expect(undoneText({ restored: 10, skipped: 0, failed: false })).toBe('Link undone');
      expect(undoneText({ restored: 10, skipped: 1, failed: false })).toBe(
        'Link undone · 1 changed since and was kept',
      );
      expect(undoneText({ restored: 10, skipped: 2, failed: false })).toBe(
        'Link undone · 2 changed since and were kept',
      );
      expect(undoneText({ restored: 0, skipped: 0, failed: true })).toBe(
        "Couldn't undo the whole link. Some of it may still be in place.",
      );
    });
  });

  describe('warningText', () => {
    it('should count the flagged ones and name the merchant that exists', () => {
      // act & assert
      expect(warningText(warning(), 11, 'Kroger')).toBe(
        "4 of these contain FUEL, which Kroger doesn't. Kroger Fuel Center exists.",
      );
    });

    it('should say "all" or "this one" when every selected description is flagged', () => {
      // act & assert
      expect(warningText(warning({ words: ['FUEL', 'CTR'] }), 4, 'Kroger')).toBe(
        "All 4 of these contain FUEL and CTR, which Kroger doesn't. Kroger Fuel Center exists.",
      );
      expect(warningText(warning({ descriptions: ['KROGER FUEL #4'] }), 1, 'Kroger')).toBe(
        "This one contains FUEL, which Kroger doesn't. Kroger Fuel Center exists.",
      );
    });

    it('should name a look-alike group when no other merchant claims the words', () => {
      // act & assert
      expect(
        warningText(
          warning({ words: ['FUEL', 'CTR', 'EXPRESS'], merchants: [], nextToGroup: 'KROGER' }),
          11,
          'Kroger',
        ),
      ).toBe(
        "4 of these contain FUEL, CTR and EXPRESS, which Kroger doesn't. KROGER FUEL CTR is its own group, apart from KROGER.",
      );
    });

    it('should join two merchants with "exist"', () => {
      // act & assert
      expect(
        warningText(
          warning({ merchants: [merchant(5, 'Kroger Fuel Center'), merchant(6, 'Kroger Fuel')] }),
          11,
          'Kroger',
        ),
      ).toBe(
        "4 of these contain FUEL, which Kroger doesn't. Kroger Fuel Center and Kroger Fuel exist.",
      );
    });
  });

  it('should collect every warned description once', () => {
    // act
    const warned = warnedDescriptions([
      warning({ descriptions: ['A', 'B'] }),
      warning({ descriptions: ['B', 'C'] }),
    ]);

    // assert & verify
    expect([...warned]).toEqual(['A', 'B', 'C']);
  });
});
