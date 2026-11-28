import { HttpErrorResponse } from '@angular/common/http';
import {
  DescriptionLinkResult,
  DescriptionLinkUndoResult,
  LookAlikeWarning,
} from '@models/merchant.model';
import { catchError, concat, map, Observable, of, toArray } from 'rxjs';
import { MerchantApiService } from '../services/merchant-api.service';
import { BULK_LINK_LIMIT, chunk } from './merchant-helpers';

/** How one bulk-link request went: its descriptions, and the result or the error's message. */
export interface LinkOutcome {
  items: string[];
  ok: boolean;
  message: string;
  result: DescriptionLinkResult | null;
}

/**
 * A finished link, as the status line shows it and Undo takes it back.
 *
 * @property merchantName - The merchant the descriptions were linked to.
 * @property linked - Descriptions now linked to it.
 * @property filled - Existing transactions that got the merchant.
 * @property results - Every successful request's result, sent back as is to undo.
 */
export interface LastLink {
  merchantName: string;
  linked: number;
  filled: number;
  results: DescriptionLinkResult[];
}

/** What undoing a link did, summed over its requests. */
export interface UndoOutcome {
  restored: number;
  skipped: number;
  failed: boolean;
}

/**
 * Links descriptions to a merchant in requests of at most 500, one after another. A failed request
 * does not stop the rest; its outcome carries the message instead of a result.
 * @param api the merchant API.
 * @param merchantId the merchant to link to.
 * @param descriptions the raw descriptions.
 * @returns every request's outcome, in order, once all have finished.
 */
export function linkInBatches(
  api: MerchantApiService,
  merchantId: number,
  descriptions: string[],
): Observable<LinkOutcome[]> {
  const send = (items: string[]): Observable<LinkOutcome> =>
    api.addDescriptionLinks(merchantId, items).pipe(
      map((result: DescriptionLinkResult): LinkOutcome => ({
        items,
        ok: true,
        message: '',
        result,
      })),
      catchError((error: HttpErrorResponse) =>
        of({
          items,
          ok: false,
          message: error.error?.detail || 'Failed to link descriptions',
          result: null,
        }),
      ),
    );
  return concat(...chunk(descriptions, BULK_LINK_LIMIT).map(send)).pipe(toArray());
}

/**
 * Sums the successful requests of a link for the status line.
 * @param merchantName the merchant linked to.
 * @param outcomes every request's outcome.
 * @returns the finished link, or null when no request succeeded.
 */
export function lastLinkOf(merchantName: string, outcomes: LinkOutcome[]): LastLink | null {
  const results: DescriptionLinkResult[] = outcomes
    .map((o: LinkOutcome): DescriptionLinkResult | null => o.result)
    .filter((r: DescriptionLinkResult | null): r is DescriptionLinkResult => r !== null);
  if (results.length === 0) return null;
  return {
    merchantName,
    linked: results.reduce((n: number, r: DescriptionLinkResult) => n + (r.linkedCount ?? 0), 0),
    filled: results.reduce(
      (n: number, r: DescriptionLinkResult) => n + (r.transactionsFilled ?? 0),
      0,
    ),
    results,
  };
}

/**
 * Takes a link back, one request per original request. A failed request is reported, not thrown.
 * @param api the merchant API.
 * @param link the finished link.
 * @returns what was restored and skipped across the requests, and whether any failed.
 */
export function undoLink(api: MerchantApiService, link: LastLink): Observable<UndoOutcome> {
  const send = (result: DescriptionLinkResult): Observable<DescriptionLinkUndoResult | null> =>
    api.undoDescriptionLinks(result).pipe(catchError(() => of(null)));
  return concat(...link.results.map(send)).pipe(
    toArray(),
    map((answers: (DescriptionLinkUndoResult | null)[]): UndoOutcome => ({
      restored: answers.reduce(
        (n: number, a) => n + (a?.linksRestored ?? 0) + (a?.transactionsRestored ?? 0),
        0,
      ),
      skipped: answers.reduce(
        (n: number, a) => n + (a?.linksSkipped ?? 0) + (a?.skippedTransactionIds?.length ?? 0),
        0,
      ),
      failed: answers.some((a) => a === null),
    })),
  );
}

/**
 * The status line for a finished link, e.g. "Linked 11 to Kroger · 205 transactions filled".
 * @param link the finished link.
 * @returns the text, without the Undo control.
 */
export function lastLinkText(link: LastLink): string {
  const filled: string =
    link.filled === 0
      ? 'no transactions filled'
      : `${link.filled} ${link.filled === 1 ? 'transaction' : 'transactions'} filled`;
  return `Linked ${link.linked} to ${link.merchantName} · ${filled}`;
}

/**
 * The status line after Undo, e.g. "Link undone" or "Link undone · 2 changed since and were kept".
 * @param outcome what the undo did.
 * @returns the text.
 */
export function undoneText(outcome: UndoOutcome): string {
  if (outcome.failed) return "Couldn't undo the whole link. Some of it may still be in place.";
  if (outcome.skipped === 0) return 'Link undone';
  return `Link undone · ${outcome.skipped} changed since and ${outcome.skipped === 1 ? 'was' : 'were'} kept`;
}

/**
 * Every description a set of warnings names, for "Leave those out".
 * @param warnings the look-alike warnings.
 * @returns the warned descriptions.
 */
export function warnedDescriptions(warnings: readonly LookAlikeWarning[]): Set<string> {
  return new Set<string>(warnings.flatMap((w: LookAlikeWarning): string[] => w.descriptions));
}

/**
 * One warning as a sentence, e.g. "4 of these contain FUEL and CTR, which Kroger doesn't. Kroger
 * Fuel Center exists."
 * @param warning the warning.
 * @param total how many descriptions are selected in all.
 * @param targetName the merchant they would be linked to.
 * @returns the sentence.
 */
export function warningText(warning: LookAlikeWarning, total: number, targetName: string): string {
  const count: number = warning.descriptions.length;
  const which: string =
    count === total
      ? count === 1
        ? 'This one contains'
        : `All ${count} of these contain`
      : `${count} of these ${count === 1 ? 'contains' : 'contain'}`;
  const claim = `${which} ${joinWords(warning.words)}, which ${targetName} doesn't.`;
  if (warning.merchants.length > 0) {
    const names: string[] = warning.merchants.map((m) => m.name);
    return `${claim} ${joinWords(names)} ${names.length === 1 ? 'exists' : 'exist'}.`;
  }
  if (warning.nextToGroup) {
    return `${claim} ${warning.groupName} is its own group, apart from ${warning.nextToGroup}.`;
  }
  return claim;
}

/** Joins words as "A", "A and B" or "A, B and C". */
function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
