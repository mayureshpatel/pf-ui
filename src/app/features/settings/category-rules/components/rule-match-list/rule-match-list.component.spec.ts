import { Mock, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, Subject } from 'rxjs';
import { Category } from '@models/category.model';
import { RuleDraft, RuleMatchPreview, RuleMatchRow, RuleRef } from '@models/category-rule.model';
import { Transaction } from '@models/transaction.model';
import { CategoryRuleApiService } from '../../services/category-rule-api.service';
import { MatchPreviewData, RuleMatchConfig, categoryMatchConfig } from './rule-match-config';
import { RuleMatchListComponent } from './rule-match-list.component';

const groceries = { id: 3, name: 'Groceries', color: '' } as Category;
const draft = (keywords: string[], over: Partial<RuleDraft> = {}): RuleDraft => ({
  ruleId: null,
  keywords,
  matchType: 'OR',
  priority: 1,
  minAmount: null,
  maxAmount: null,
  ...over,
});
const ref = (
  id: number,
  keywords: string[],
  categoryName: string | null,
  priority: number,
): RuleRef => ({
  id,
  keywords,
  categoryName,
  priority,
});
const row = (transactionId: number, over: Partial<RuleMatchRow> = {}): RuleMatchRow => ({
  transactionId,
  date: '2026-10-05T00:00:00Z',
  description: `COSTCO WHSE #${transactionId}`,
  amount: -42.5,
  accountName: 'Checking',
  currentCategory: null,
  verdict: 'WILL_CATEGORIZE',
  otherRules: [],
  ...over,
});
const preview = (rows: RuleMatchRow[], over: Partial<RuleMatchPreview> = {}): RuleMatchPreview => ({
  totalMatches: rows.length,
  willCategorizeCount: rows.filter((r) => r.verdict === 'WILL_CATEGORIZE').length,
  losesToOtherRuleCount: rows.filter((r) => r.verdict === 'LOSES_TO_OTHER_RULE').length,
  alreadyCategorizedCount: rows.filter((r) => r.verdict === 'ALREADY_CATEGORIZED').length,
  truncated: false,
  rows,
  ...over,
});
const txn = (id: number, description: string, amount: number, date: string): Transaction =>
  ({ id, description, amount, date, category: null }) as Transaction;

describe('RuleMatchListComponent', () => {
  let fixture: ComponentFixture<RuleMatchListComponent>;
  let previewMatches: Mock<(d: RuleDraft) => Observable<RuleMatchPreview>>;
  let calls: Subject<RuleMatchPreview>[];

  const el = (): HTMLElement => fixture.nativeElement;
  const text = (): string => (el().textContent ?? '').replace(/\s+/g, ' ');
  const rows = (): HTMLLIElement[] => Array.from(el().querySelectorAll('[data-match-row]'));
  const rowText = (i: number): string => (rows()[i].textContent ?? '').replace(/\s+/g, ' ');
  const summary = (): HTMLElement => el().querySelector('[data-testid="match-summary"]')!;
  const retryButton = (): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(el().querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith('Retry'),
    );
  /** searches, then fails the request the next draft sends */
  function failNext(value: RuleDraft): void {
    setDraft(value);
    vi.advanceTimersByTime(300);
    calls[calls.length - 1].error(new Error('boom'));
    fixture.detectChanges();
  }

  function setDraft(value: RuleDraft | null): void {
    fixture.componentRef.setInput('draft', value);
    fixture.detectChanges();
  }
  /** sets a draft, lets the debounce elapse and answers the request it sends */
  function answer(value: RuleMatchPreview): void {
    calls[calls.length - 1].next(value);
    calls[calls.length - 1].complete();
    fixture.detectChanges();
  }
  function search(value: RuleDraft, result: RuleMatchPreview): void {
    setDraft(value);
    vi.advanceTimersByTime(300);
    answer(result);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    previewMatches = vi.fn((): Observable<RuleMatchPreview> => {
      const subject = new Subject<RuleMatchPreview>();
      calls.push(subject);
      return subject;
    });
    TestBed.configureTestingModule({
      imports: [RuleMatchListComponent],
      providers: [{ provide: CategoryRuleApiService, useValue: { previewMatches } }],
    });
    fixture = TestBed.createComponent(RuleMatchListComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a prompt and sends no request while keywords are empty or blank', () => {
    // act
    setDraft(null);
    vi.advanceTimersByTime(1000);
    setDraft(draft([]));
    vi.advanceTimersByTime(1000);
    setDraft(draft(['  ', '']));
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    // assert & verify
    expect(text()).toContain('Type a keyword to see which transactions it would match');
    expect(previewMatches).not.toHaveBeenCalled();
  });

  it('lists the selected transactions as context while the keyword is empty', () => {
    // arrange
    fixture.componentRef.setInput('context', [
      txn(1, 'TRADER JOES #12', -18.25, '2026-10-02T00:00:00Z'),
      txn(2, 'WHOLE FOODS', -64, '2026-10-03T00:00:00Z'),
    ]);

    // act
    setDraft(draft(['']));

    // assert & verify
    const context = el().querySelector('[aria-label="Selected transactions"]')!;
    expect(context).not.toBeNull();
    const items = context.querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Oct 2, 2026');
    expect(items[0].textContent).toContain('TRADER JOES #12');
    expect(items[0].textContent).toContain('-$18.25');
    expect(items[1].textContent).toContain('WHOLE FOODS');
  });

  it('debounces typing into one request for the last draft', () => {
    // act
    setDraft(draft(['c']));
    vi.advanceTimersByTime(100);
    setDraft(draft(['co']));
    vi.advanceTimersByTime(100);
    setDraft(draft(['costco']));
    vi.advanceTimersByTime(299);

    // assert & verify
    expect(previewMatches).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(previewMatches).toHaveBeenCalledTimes(1);
    expect(previewMatches).toHaveBeenCalledWith(draft(['costco']));
  });

  it('renders the summary counts and rows (date, description, amount, account, current category)', () => {
    // act
    search(
      draft(['costco']),
      preview([
        row(1, { accountName: 'Visa', amount: -42.5, date: '2026-10-05' }),
        row(2, { verdict: 'ALREADY_CATEGORIZED', currentCategory: groceries }),
        row(3, {
          verdict: 'LOSES_TO_OTHER_RULE',
          otherRules: [ref(9, ['whse'], 'Bulk', 5)],
        }),
        row(4, { otherRules: [ref(8, ['co'], 'Misc', 0)] }),
      ]),
    );

    // assert & verify
    const s = summary().textContent!.replace(/\s+/g, ' ');
    expect(summary().getAttribute('aria-live')).toBe('polite');
    expect(s).toContain('4 matches');
    expect(s).toContain('2 will be categorized by this rule');
    expect(s).toContain('1 of them: no other rule affects it');
    expect(s).toContain('1 would lose to another rule');
    expect(s).toContain('1 already categorized - Apply rules leaves them alone');
    expect(rows().length).toBe(4);
    expect(rowText(0)).toContain('Oct 5, 2026');
    expect(rowText(0)).toContain('COSTCO WHSE #1');
    expect(rowText(0)).toContain('-$42.50');
    expect(rowText(0)).toContain('Visa');
    expect(rowText(0)).toContain('Uncategorized');
    expect(rowText(1)).toContain('Groceries');
  });

  it('says "1 match" for a single match', () => {
    // act
    search(draft(['costco']), preview([row(1)]));

    // assert & verify
    expect(summary().textContent).toContain('1 match');
    expect(summary().textContent).not.toContain('1 matches');
  });

  it('labels each row by verdict with icon and text, naming the winning rule', () => {
    // act
    search(
      draft(['costco']),
      preview([
        row(1),
        row(2, {
          verdict: 'LOSES_TO_OTHER_RULE',
          otherRules: [ref(9, ['costco', 'gas'], 'Gas', 7), ref(4, ['whse'], 'Bulk', 2)],
        }),
        row(3, {
          verdict: 'ALREADY_CATEGORIZED',
          currentCategory: groceries,
          otherRules: [ref(5, ['costco'], 'Groceries', 3)],
        }),
      ]),
    );

    // assert & verify
    const verdicts = rows().map((r) => r.querySelector('[data-testid="verdict"]')!);
    verdicts.forEach((v) => expect(v.querySelector('i.pi[aria-hidden="true"]')).not.toBeNull());
    expect(verdicts[0].textContent).toContain('Will be categorized');
    expect(verdicts[1].textContent!.replace(/\s+/g, ' ')).toContain(
      'Loses to a rule with keywords "costco", "gas" (priority 7)',
    );
    expect(verdicts[2].textContent).toContain('Already categorized - Apply rules leaves it alone');
    expect(rowText(1)).toContain('Also matches: a rule with keyword "whse"');
    expect(rowText(1)).toContain('Bulk (priority 2)');
    expect(rowText(2)).toContain('Also matches: a rule with keyword "costco"');
    expect(rowText(2)).toContain('Groceries (priority 3)');
    expect(rowText(0)).not.toContain('Also matches');
  });

  it("shows 'and N more' when truncated, with the split from the backend counts only", () => {
    // act
    search(
      draft(['costco']),
      preview([row(1), row(2)], {
        totalMatches: 120,
        willCategorizeCount: 100,
        losesToOtherRuleCount: 15,
        alreadyCategorizedCount: 5,
        truncated: true,
      }),
    );

    // assert & verify
    expect(summary().textContent).toContain('120 matches');
    expect(summary().textContent).toContain('100 will be categorized by this rule');
    expect(summary().textContent).not.toContain('no other rule affects it');
    expect(text()).toContain('and 118 more');
  });

  it('keeps the previous rows visible and marks the list busy while loading', () => {
    // arrange
    search(draft(['costco']), preview([row(1)]));

    // act
    setDraft(draft(['costco whse']));
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    // assert & verify
    expect(rows().length).toBe(1);
    expect(el().querySelector('[data-testid="match-results"]')!.getAttribute('aria-busy')).toBe(
      'true',
    );
    answer(preview([row(1), row(2)]));
    expect(rows().length).toBe(2);
    expect(el().querySelector('[data-testid="match-results"]')!.getAttribute('aria-busy')).toBe(
      'false',
    );
  });

  it('shows an inline error with a retry that re-requests', () => {
    // arrange
    search(draft(['costco']), preview([row(1)]));
    setDraft(draft(['costc']));
    vi.advanceTimersByTime(300);

    // act
    calls[1].error(new Error('boom'));
    fixture.detectChanges();

    // assert & verify
    expect(text()).toContain("Couldn't load matching transactions");
    expect(rows().length).toBe(0);
    const retry = Array.from(el().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Retry',
    )!;
    retry.click();
    fixture.detectChanges();
    expect(previewMatches).toHaveBeenCalledTimes(3);
    expect(previewMatches).toHaveBeenLastCalledWith(draft(['costc']));
    answer(preview([row(7)]));
    expect(text()).not.toContain("Couldn't load matching transactions");
    expect(rows().length).toBe(1);
  });

  it('never lets a slow earlier response replace a newer one', () => {
    // arrange
    setDraft(draft(['cost']));
    vi.advanceTimersByTime(300);
    const slow = calls[0];
    setDraft(draft(['costco']));
    vi.advanceTimersByTime(300);
    answer(preview([row(2, { description: 'NEWER' })]));

    // act
    slow.next(preview([row(1, { description: 'OLDER' })]));
    fixture.detectChanges();

    // assert & verify
    expect(slow.observed).toBe(false);
    expect(text()).toContain('NEWER');
    expect(text()).not.toContain('OLDER');
  });

  it('cancels the in-flight request as soon as a newer draft arrives', () => {
    // arrange
    setDraft(draft(['cost']));
    vi.advanceTimersByTime(300);

    // act
    setDraft(draft(['costco']));

    // assert & verify
    expect(calls[0].observed).toBe(false);
  });

  it('cancels the in-flight request when the draft becomes null and shows the prompt', () => {
    // arrange
    search(draft(['costco']), preview([row(1)]));
    setDraft(draft(['costco whse']));
    vi.advanceTimersByTime(300);

    // act
    setDraft(null);

    // assert & verify
    expect(calls[1].observed).toBe(false);
    expect(rows().length).toBe(0);
    expect(text()).toContain('Type a keyword to see which transactions it would match');
  });

  it('sends no request after destroy and cancels the in-flight one', () => {
    // arrange
    setDraft(draft(['cost']));
    vi.advanceTimersByTime(300);
    const inFlight = calls[0];
    setDraft(draft(['costco']));

    // act
    fixture.destroy();
    vi.advanceTimersByTime(1000);

    // assert & verify
    expect(inFlight.observed).toBe(false);
    expect(previewMatches).toHaveBeenCalledTimes(1);
  });

  it('shows a dash for an invalid date', () => {
    // act
    search(draft(['costco']), preview([row(1, { date: 'not-a-date' }), row(2, { date: '' })]));

    // assert & verify
    const dates = rows().map((r) => r.querySelector('[data-testid="row-date"]')!.textContent);
    expect(dates.map((d) => d?.trim())).toEqual(['-', '-']);
  });

  it('says no transactions match for zero matches', () => {
    // act
    search(draft(['zzz']), preview([]));

    // assert & verify
    expect(summary().textContent).toContain('No transactions match');
    expect(rows().length).toBe(0);
  });

  it('has a named list and rows readable in one pass', () => {
    // act
    search(
      draft(['costco']),
      preview([row(1, { date: '2026-10-05', verdict: 'WILL_CATEGORIZE' })]),
    );

    // assert & verify
    const region = el().querySelector('[data-testid="match-rows"]')!;
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-label')).toBe('Matching transactions');
    const list = region.querySelector('ul');
    expect(list).not.toBeNull();
    // the list inside does not repeat the region's name
    expect(list!.getAttribute('aria-label')).not.toBe(region.getAttribute('aria-label'));
    const line = rowText(0);
    const order = ['Oct 5, 2026', 'COSTCO WHSE #1', '-$42.50', 'Will be categorized'].map((part) =>
      line.indexOf(part),
    );
    order.forEach((index) => expect(index).toBeGreaterThanOrEqual(0));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('asks to fix the keywords instead of prompting for one when the input is invalid', () => {
    // act
    fixture.componentRef.setInput('invalid', true);
    setDraft(null);
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    // assert & verify
    expect(text()).toContain('Fix the keywords to see matches');
    expect(text()).not.toContain('Type a keyword to see which transactions it would match');
    expect(previewMatches).not.toHaveBeenCalled();

    // act -- valid again, still empty
    fixture.componentRef.setInput('invalid', false);
    fixture.detectChanges();

    // assert & verify
    expect(text()).toContain('Type a keyword to see which transactions it would match');
  });

  it('clears the error as soon as a new draft arrives, before the debounce elapses', () => {
    // arrange
    failNext(draft(['costco']));
    expect(text()).toContain("Couldn't load matching transactions");

    // act
    setDraft(draft(['costco whse']));
    fixture.detectChanges();

    // assert & verify
    expect(text()).not.toContain("Couldn't load matching transactions");
    vi.advanceTimersByTime(300);
    expect(previewMatches).toHaveBeenCalledTimes(2);
  });

  it('keeps keyboard focus inside the list while a retry is in flight and after it settles', () => {
    // arrange
    failNext(draft(['costco']));
    const button = retryButton()!;
    button.focus();

    // act
    button.click();
    fixture.detectChanges();

    // assert & verify -- in flight: the same button keeps focus and says it is busy
    expect(previewMatches).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.textContent).toContain('Retrying');
    button.click();
    expect(previewMatches).toHaveBeenCalledTimes(2);

    // act -- it succeeds
    answer(preview([row(1)]));
    fixture.detectChanges();

    // assert & verify
    expect(rows().length).toBe(1);
    expect(document.activeElement).not.toBe(document.body);
    expect(el().contains(document.activeElement)).toBe(true);
  });

  it('keeps focus on Retry when the retry fails again', () => {
    // arrange
    failNext(draft(['costco']));
    const button = retryButton()!;
    button.focus();
    button.click();
    fixture.detectChanges();

    // act
    calls[1].error(new Error('boom'));
    fixture.detectChanges();

    // assert & verify
    expect(text()).toContain("Couldn't load matching transactions");
    expect(document.activeElement).toBe(retryButton());
    expect(retryButton()!.getAttribute('aria-disabled')).toBe('false');
  });

  it('sends no new request for a draft with the same content', () => {
    // arrange
    search(draft(['costco']), preview([row(1)]));

    // act
    setDraft(draft(['costco']));
    setDraft(draft([' costco ', '']));
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    // assert & verify
    expect(previewMatches).toHaveBeenCalledTimes(1);
    expect(rows().length).toBe(1);
  });

  it("falls back to 'Loses to another rule' when no competing rule is named", () => {
    // act
    search(
      draft(['costco']),
      preview([row(1, { verdict: 'LOSES_TO_OTHER_RULE', otherRules: [] })]),
    );

    // assert & verify
    const verdict = rows()[0].querySelector('[data-testid="verdict"]')!;
    expect(verdict.textContent).toContain('Loses to another rule');
  });

  it('names a missing account and a missing category instead of leaving them blank', () => {
    // act
    search(
      draft(['costco']),
      preview([row(1, { accountName: null, otherRules: [ref(4, ['whse'], null, 2)] })]),
    );

    // assert & verify
    expect(rowText(0)).toContain('Account: (no account)');
    expect(rowText(0)).toContain('(no category) (priority 2)');
  });

  it('shows a count line only when it is above zero', () => {
    // act
    search(draft(['costco']), preview([row(1), row(2)]));

    // assert & verify
    const s = summary().textContent!.replace(/\s+/g, ' ');
    expect(s).toContain('2 matches');
    expect(s).toContain('2 will be categorized by this rule');
    expect(s).not.toContain('would lose to another rule');
    expect(s).not.toContain('already categorized');

    // act -- none would be categorized: that line stays, the others appear
    search(
      draft(['costco whse']),
      preview([
        row(3, { verdict: 'LOSES_TO_OTHER_RULE', otherRules: [ref(9, ['whse'], 'Bulk', 5)] }),
        row(4, { verdict: 'ALREADY_CATEGORIZED', currentCategory: groceries }),
      ]),
    );

    // assert & verify
    const t = summary().textContent!.replace(/\s+/g, ' ');
    expect(t).toContain('0 will be categorized by this rule');
    expect(t).toContain('1 would lose to another rule');
    expect(t).toContain('1 already categorized - Apply rules leaves them alone');
  });

  it("names another rule's keywords neutrally, since its match type is not known", () => {
    // act
    search(
      draft(['costco']),
      preview([
        row(1, {
          verdict: 'LOSES_TO_OTHER_RULE',
          otherRules: [ref(9, ['kroger', '431'], 'Groceries', 5), ref(4, ['whse'], 'Bulk', 2)],
        }),
      ]),
    );

    // assert & verify
    const verdict = rows()[0].querySelector('[data-testid="verdict"]')!;
    expect(verdict.textContent!.replace(/\s+/g, ' ')).toContain(
      'Loses to a rule with keywords "kroger", "431" (priority 5)',
    );
    expect(rowText(0)).toContain('Also matches: a rule with keyword "whse"');
    // neither "+" (reads as all) nor a bare comma list (reads as one rule's alternatives)
    expect(rowText(0)).not.toContain('+');
    expect(rowText(0)).not.toContain('kroger, 431');
  });

  describe('in a real layout', () => {
    const many = (n: number): RuleMatchRow[] => Array.from({ length: n }, (_, i) => row(i + 1));
    const rowsBox = (): HTMLElement | null => el().querySelector('[data-testid="match-rows"]');
    const section = (): HTMLElement => el().querySelector('section')!;

    beforeEach(() => {
      document.body.appendChild(el());
    });
    afterEach(() => {
      el().remove();
    });

    it('scrolls a long list inside a bounded, keyboard-scrollable box under the summary', async () => {
      // arrange
      const { page } = await import('vitest/browser');
      const before = { width: window.innerWidth, height: window.innerHeight };
      const check = (): void => {
        const box = rowsBox()!;
        expect(box).not.toBeNull();
        expect(box.getAttribute('tabindex')).toBe('0');
        expect(box.getAttribute('aria-label')).toBeTruthy();
        expect(box.contains(summary())).toBe(false);
        expect(box.querySelectorAll('[data-match-row]').length).toBe(50);
        expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
        expect(box.clientHeight).toBeLessThanOrEqual(400);
        expect(el().getBoundingClientRect().height).toBeLessThan(700);
        expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
        // nothing inside (e.g. the rows' screen-reader labels) escapes the box to stretch the page
        expect(document.documentElement.scrollHeight).toBeLessThan(
          window.innerHeight + el().getBoundingClientRect().bottom,
        );
      };

      try {
        // act
        search(
          draft(['costco']),
          preview(many(50), { totalMatches: 137, willCategorizeCount: 137, truncated: true }),
        );

        // assert & verify
        check();

        // act -- loading the next draft keeps the bounded box
        setDraft(draft(['costco whse']));
        vi.advanceTimersByTime(300);
        fixture.detectChanges();

        // assert & verify
        expect(el().querySelector('[data-testid="match-results"]')!.getAttribute('aria-busy')).toBe(
          'true',
        );
        check();

        // act -- a phone
        await page.viewport(375, 812);
        answer(preview(many(50), { totalMatches: 60, willCategorizeCount: 60, truncated: true }));

        // assert & verify
        check();
      } finally {
        await page.viewport(before.width, before.height);
      }
    });

    it('holds the height of what was shown while the next draft loads, then lets it go', () => {
      // arrange
      search(draft(['costco']), preview(many(50)));
      failNext(draft(['costc']));
      const shown = section().getBoundingClientRect().height;
      search(draft(['costco']), preview(many(50)));
      const tall = section().getBoundingClientRect().height;
      expect(tall).toBeGreaterThan(shown);

      // act -- a new draft: the old list stays (dimmed) until the answer
      setDraft(draft(['zzqqxx']));
      vi.advanceTimersByTime(300);
      fixture.detectChanges();

      // assert & verify
      expect(section().getBoundingClientRect().height).toBeGreaterThanOrEqual(tall - 1);

      // act -- a failed request's alert gives way to the loading state at once
      failNext(draft(['zzq']));
      const alertHeight = section().getBoundingClientRect().height;
      setDraft(draft(['zzqq']));

      // assert & verify
      expect(text()).not.toContain("Couldn't load matching transactions");
      expect(section().getBoundingClientRect().height).toBeGreaterThanOrEqual(alertHeight - 1);

      // act
      vi.advanceTimersByTime(300);
      answer(preview([]));

      // assert & verify -- settled: no held height is left behind
      expect(section().style.minHeight).toBe('');
      expect(section().getBoundingClientRect().height).toBeLessThan(alertHeight);
    });
  });

  describe('selectable mode (PF-926)', () => {
    let selections: number[][];
    const boxes = (): HTMLInputElement[] =>
      Array.from(
        el().querySelectorAll<HTMLInputElement>('[data-match-row] input[type="checkbox"]'),
      );
    const groupBox = (title: string): HTMLInputElement =>
      Array.from(el().querySelectorAll<HTMLInputElement>('[data-testid="group-checkbox"]')).find(
        (b) => (b.getAttribute('aria-label') ?? '').includes(title),
      )!;
    const lastSelection = (): number[] => selections[selections.length - 1];
    const mixed = (): RuleMatchPreview =>
      preview([
        row(1),
        row(2),
        row(3, { verdict: 'ALREADY_CATEGORIZED', currentCategory: groceries }),
        row(4, { verdict: 'LOSES_TO_OTHER_RULE', otherRules: [ref(9, ['costco'], 'Shopping', 5)] }),
      ]);

    beforeEach(() => {
      selections = [];
      fixture.componentInstance.selectionChange.subscribe((ids: number[]) => selections.push(ids));
      fixture.componentRef.setInput('selectable', true);
      fixture.componentRef.setInput('becomes', 'Fast Food');
      fixture.detectChanges();
    });

    it('should show no checkboxes unless the list is selectable', () => {
      // arrange
      fixture.componentRef.setInput('selectable', false);
      fixture.detectChanges();

      // act
      search(draft(['costco']), mixed());

      // assert & verify
      expect(boxes().length).toBe(0);
    });

    it('should list the matches in three groups, each with its count', () => {
      // act
      search(draft(['costco']), mixed());

      // assert & verify
      const groups = Array.from(el().querySelectorAll('[data-testid="match-group"]')).map((g) =>
        (g.querySelector('[data-testid="group-title"]')?.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim(),
      );
      expect(groups).toEqual([
        'Will be set (no category today) 2',
        'Will change 1',
        "Won't change 1",
      ]);
    });

    it('should start with only the rows that have no category ticked, and emit them', () => {
      // act
      search(draft(['costco']), mixed());

      // assert & verify -- in group order: two blank rows, the categorized row, the losing row
      expect(boxes().map((b) => b.checked)).toEqual([true, true, false, false]);
      expect(lastSelection()).toEqual([1, 2]);
    });

    it('should emit the new selection when a row is ticked or unticked', () => {
      // arrange
      search(draft(['costco']), mixed());

      // act
      boxes()[2].click();
      fixture.detectChanges();
      boxes()[0].click();
      fixture.detectChanges();

      // assert & verify
      expect(lastSelection()).toEqual([2, 3]);
    });

    it('should tick or untick a whole group from its header, and show a partial state', () => {
      // arrange
      search(draft(['costco']), mixed());

      // act -- untick the group, then tick one of its rows
      groupBox('Will be set').click();
      fixture.detectChanges();
      const afterUntick = lastSelection();
      boxes()[0].click();
      fixture.detectChanges();

      // assert & verify
      expect(afterUntick).toEqual([]);
      expect(groupBox('Will be set').indeterminate).toBe(true);

      // act -- the header ticks the rest
      groupBox('Will be set').click();
      fixture.detectChanges();

      // assert & verify
      expect(lastSelection()).toEqual([1, 2]);
      expect(groupBox('Will be set').indeterminate).toBe(false);
    });

    it('should show what a row that already has a value would change from and to', () => {
      // act
      search(draft(['costco']), mixed());

      // assert & verify
      const changeRow = rowText(2);
      expect(changeRow).toContain('Was Groceries');
      expect(changeRow).toContain('becomes Fast Food');
    });

    it('should name each checkbox after the transaction it would update', () => {
      // act
      search(draft(['costco']), mixed());

      // assert & verify
      expect(boxes()[0].getAttribute('aria-label')).toBe('Update COSTCO WHSE #1');
    });

    it('should select every blank match, listed or not, when more match than the rows list', () => {
      // arrange -- 70 blank matches, only 50 listed
      const listed = Array.from({ length: 50 }, (_, n) => row(n + 1));
      const everyBlank = Array.from({ length: 70 }, (_, n) => n + 1);

      // act
      search(
        draft(['costco']),
        preview(listed, {
          totalMatches: 70,
          willCategorizeCount: 70,
          truncated: true,
          willCategorizeIds: everyBlank,
        }),
      );

      // assert & verify -- all 70 count, and the header unticks all 70
      expect(lastSelection().length).toBe(70);
      expect(text()).toContain('and 20 more');
      groupBox('Will be set').click();
      fixture.detectChanges();
      expect(lastSelection()).toEqual([]);
    });

    it('should keep the ticks of rows that stay when the draft changes, and give new rows the default', () => {
      // arrange
      search(draft(['costco']), preview([row(1), row(2)]));
      boxes()[0].click();
      fixture.detectChanges();

      // act -- a longer keyword brings a third blank row
      search(draft(['costco', 'whse']), preview([row(1), row(2), row(5)]));

      // assert & verify -- row 1 stays unticked, the new row 5 starts ticked
      expect(boxes().map((b) => b.checked)).toEqual([false, true, true]);
      expect(lastSelection()).toEqual([2, 5]);
    });

    it('should select nothing while there is no keyword', () => {
      // arrange
      search(draft(['costco']), mixed());

      // act
      setDraft(draft([]));

      // assert & verify
      expect(lastSelection()).toEqual([]);
    });
  });

  describe('another kind of rule through matchConfig (PF-932)', () => {
    it('should preview with the given config and use its wording, not the injected category config', () => {
      // arrange
      const previewWith = vi.fn((): Observable<MatchPreviewData> =>
        of({
          totalMatches: 1,
          willApplyCount: 1,
          losesToOtherRuleCount: 0,
          alreadySetCount: 0,
          linkedCount: 0,
          truncated: false,
          targetName: 'Kroger',
          willApplyIds: [1],
          rows: [
            {
              transactionId: 1,
              date: '2026-10-05T00:00:00Z',
              description: 'KROGER #123',
              amount: -10,
              accountName: 'Checking',
              currentName: null,
              verdict: 'WILL_APPLY',
              winner: null,
              alsoMatches: [],
            },
          ],
        }),
      );
      const config: RuleMatchConfig = {
        preview: previewWith,
        labels: {
          ...categoryMatchConfig({ previewMatches } as never).labels,
          currentNone: 'No merchant',
          willRow: (name: string | null): string => `Will be assigned to ${name}`,
        },
      };
      fixture.componentRef.setInput('matchConfig', config);

      // act
      setDraft(draft(['kroger']));
      vi.advanceTimersByTime(300);
      fixture.detectChanges();

      // assert & verify
      expect(previewWith).toHaveBeenCalledTimes(1);
      expect(previewMatches).not.toHaveBeenCalled();
      expect(rowText(0)).toContain('No merchant');
      expect(rowText(0)).toContain('Will be assigned to Kroger');
    });
  });
});
