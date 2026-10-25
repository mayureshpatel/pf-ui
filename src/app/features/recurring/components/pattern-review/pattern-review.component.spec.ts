import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Account } from '@models/account.model';
import { Merchant } from '@models/merchant.model';
import { DismissedPattern, RecurringSuggestion } from '@models/recurring.model';
import {
  CREATE_MERCHANT_ID,
  PatternAcceptance,
  PatternReviewComponent,
} from './pattern-review.component';

const accounts = [
  { id: 1, name: 'Checking' },
  { id: 2, name: 'Credit Card' },
] as Account[];
const merchants = [
  { id: 10, name: 'Netflix' },
  { id: 11, name: 'Spotify' },
] as Merchant[];

const pattern = (name: string, over: Partial<RecurringSuggestion> = {}): RecurringSuggestion => ({
  merchant: { name } as Merchant,
  amount: 22.99,
  frequency: 'MONTHLY',
  lastDate: '2026-10-03',
  nextDate: '2026-11-03',
  occurrenceCount: 8,
  confidenceScore: 80,
  accountId: 2,
  accountName: 'Credit Card',
  patternKey: name.toLowerCase(),
  ...over,
});

const dismissedRow: DismissedPattern = {
  id: 5,
  patternKey: 'old thing',
  name: 'Old Thing',
  dismissedAt: '2026-10-01T00:00:00Z',
};

describe('PatternReviewComponent', () => {
  let fixture: ComponentFixture<PatternReviewComponent>;
  let component: PatternReviewComponent;

  function render(
    over: Partial<{
      patterns: RecurringSuggestion[];
      dismissed: DismissedPattern[];
      selected: RecurringSuggestion | null;
      saving: boolean;
    }> = {},
  ): void {
    fixture.componentRef.setInput('patterns', over.patterns ?? []);
    fixture.componentRef.setInput('dismissed', over.dismissed ?? []);
    fixture.componentRef.setInput('merchants', merchants);
    fixture.componentRef.setInput('accounts', accounts);
    fixture.componentRef.setInput('selected', over.selected ?? null);
    fixture.componentRef.setInput('saving', over.saving ?? false);
    fixture.detectChanges();
  }
  const all = <T extends HTMLElement>(s: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(s));
  const text = (e: Element | null | undefined): string =>
    (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const button = (name: string): HTMLButtonElement | undefined =>
    all<HTMLButtonElement>('button').find((b) => text(b) === name);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatternReviewComponent, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(PatternReviewComponent);
    component = fixture.componentInstance;
  });

  describe('the list', () => {
    it('should list patterns in the given order with a confidence word', () => {
      // act
      render({
        patterns: [
          pattern('Netflix'),
          pattern('Planet Fit', { confidenceScore: 54, occurrenceCount: 4 }),
        ],
      });

      // assert & verify
      const rows = all('[data-testid="pattern-row"]').map(text);
      expect(rows[0]).toContain('Netflix');
      expect(rows[0]).toContain('Monthly · last $22.99 · seen 8 times');
      expect(rows[0]).toContain('High');
      expect(rows[1]).toContain('Planet Fit');
      expect(rows[1]).toContain('Medium');
    });

    it('should emit choose for the clicked pattern', () => {
      // arrange
      const chosen: RecurringSuggestion[] = [];
      component.choose.subscribe((p: RecurringSuggestion) => chosen.push(p));
      render({ patterns: [pattern('Netflix'), pattern('Hulu')] });

      // act
      all<HTMLButtonElement>('[data-testid="pattern-row"]')[1].click();

      // assert & verify
      expect(chosen.map((p) => p.patternKey)).toEqual(['hulu']);
    });

    it('should say nothing was found when there are no patterns', () => {
      // act
      render();

      // assert & verify
      expect(text(fixture.nativeElement)).toContain('No patterns found.');
    });

    it('should show the dismissed list on demand and emit restore', () => {
      // arrange
      const restored: DismissedPattern[] = [];
      component.restore.subscribe((d: DismissedPattern) => restored.push(d));
      render({ dismissed: [dismissedRow] });

      // act
      button('Dismissed (1)')?.click();
      fixture.detectChanges();
      button('Restore')?.click();

      // assert & verify
      expect(text(fixture.nativeElement)).toContain('Old Thing');
      expect(restored).toEqual([dismissedRow]);
    });

    it('should not offer a dismissed link when nothing was dismissed', () => {
      // act
      render();

      // assert & verify
      expect(button('Dismissed (0)')).toBeUndefined();
    });
  });

  describe('the review form', () => {
    it('should prefill the amount, frequency, date and account from the pattern', () => {
      // act
      render({ selected: pattern('Netflix') });

      // assert & verify
      const value = component.form.getRawValue();
      expect(value.amount).toBe(22.99);
      expect(value.frequency).toBe('MONTHLY');
      expect(value.nextDate).toEqual(new Date(2026, 10, 3));
      expect(value.accountId).toBe(2);
    });

    it('should leave the account empty when the pattern has none that the user still has', () => {
      // act
      render({ selected: pattern('Netflix', { accountId: 99 }) });

      // assert & verify
      expect(component.form.controls.accountId.value).toBeNull();
    });

    it('should preselect a merchant whose name matches ignoring case and spacing', () => {
      // act
      render({ selected: pattern('  NETFLIX ') });

      // assert & verify
      expect(component.form.controls.merchantId.value).toBe(10);
    });

    it('should preselect the merchant the detected text is already linked to, even when it is not in the list', () => {
      // act
      render({
        selected: pattern('NETFLIX.COM 866-579', {
          linkedMerchantId: 77,
          linkedMerchantName: 'Streaming Co',
        }),
      });

      // assert & verify
      expect(component.form.controls.merchantId.value).toBe(77);
      expect(component.merchantOptions().map((m) => m.id)).toContain(77);
      expect(component.merchantOptions().find((m) => m.id === 77)?.name).toBe('Streaming Co');
    });

    it('should prefer the linked merchant over a merchant that merely has the same name', () => {
      // act
      render({
        selected: pattern('Netflix', { linkedMerchantId: 77, linkedMerchantName: 'Streaming Co' }),
      });

      // assert & verify
      expect(component.form.controls.merchantId.value).toBe(77);
    });

    it('should offer to create a merchant with an editable name when none matches', () => {
      // act
      render({ selected: pattern('NETFLIX.COM 866') });

      // assert & verify
      expect(component.form.controls.merchantId.value).toBe(CREATE_MERCHANT_ID);
      expect(component.form.controls.newMerchantName.value).toBe('NETFLIX.COM 866');
      expect(fixture.nativeElement.querySelector('#pattern-new-merchant')).not.toBeNull();
    });

    it('should show the amount history only when the price changed', () => {
      // act
      render({
        selected: pattern('Netflix', { previousAmount: 9.99, priceChangedOn: '2026-09-03' }),
      });

      // assert & verify
      expect(text(fixture.nativeElement.querySelector('[data-testid="amount-history"]'))).toBe(
        'Was $9.99 before Sep 3',
      );

      // act
      render({ selected: pattern('Spotify') });

      // assert & verify
      expect(fixture.nativeElement.querySelector('[data-testid="amount-history"]')).toBeNull();
    });

    it('should emit add with a merchant id and no new name for an existing merchant', () => {
      // arrange
      const added: PatternAcceptance[] = [];
      component.add.subscribe((a: PatternAcceptance) => added.push(a));
      render({ selected: pattern('Netflix') });

      // act
      component.submit();

      // assert & verify
      expect(added).toHaveLength(1);
      expect(added[0].merchantId).toBe(10);
      expect(added[0].newMerchantName).toBeNull();
      expect(added[0]).toMatchObject({
        accountId: 2,
        amount: 22.99,
        frequency: 'MONTHLY',
        nextDate: '2026-11-03',
      });
      expect(added[0].pattern.patternKey).toBe('netflix');
    });

    it('should emit add with a new merchant name and no merchant id when creating one', () => {
      // arrange
      const added: PatternAcceptance[] = [];
      component.add.subscribe((a: PatternAcceptance) => added.push(a));
      render({ selected: pattern('NETFLIX.COM 866') });
      component.form.controls.newMerchantName.setValue('  Netflix Inc  ');

      // act
      component.submit();

      // assert & verify
      expect(added[0].merchantId).toBeNull();
      expect(added[0].newMerchantName).toBe('Netflix Inc');
    });

    it('should not emit while a created merchant has a blank name', () => {
      // arrange
      const added: PatternAcceptance[] = [];
      component.add.subscribe((a: PatternAcceptance) => added.push(a));
      render({ selected: pattern('NETFLIX.COM 866') });
      component.form.controls.newMerchantName.setValue('   ');

      // act
      component.submit();

      // assert & verify
      expect(added).toEqual([]);
    });

    it('should disable Add to recurring while the form is invalid or a save is running', () => {
      // act
      render({ selected: pattern('Netflix', { accountId: 99 }) });

      // assert & verify
      expect(button('Add to recurring')?.disabled).toBe(true);

      // act
      component.form.controls.accountId.setValue(1);
      fixture.detectChanges();

      // assert & verify
      expect(button('Add to recurring')?.disabled).toBe(false);

      // act
      render({ selected: pattern('Netflix'), saving: true });

      // assert & verify
      expect(button('Add to recurring')?.disabled).toBe(true);
    });

    it('should emit dismiss and backToList', () => {
      // arrange
      const events: string[] = [];
      component.dismiss.subscribe((p: RecurringSuggestion) =>
        events.push(`dismiss:${p.patternKey}`),
      );
      component.backToList.subscribe(() => events.push('back'));
      render({ selected: pattern('Netflix') });

      // act
      button('Dismiss')?.click();
      button('Back to patterns')?.click();

      // assert & verify
      expect(events).toEqual(['dismiss:netflix', 'back']);
    });

    it('should refill when another pattern is chosen', () => {
      // arrange
      render({ selected: pattern('Netflix') });
      component.form.controls.amount.setValue(1);

      // act
      render({ selected: pattern('Spotify', { amount: 11.99 }) });

      // assert & verify
      expect(component.form.controls.amount.value).toBe(11.99);
      expect(component.form.controls.merchantId.value).toBe(11);
    });
  });
});
