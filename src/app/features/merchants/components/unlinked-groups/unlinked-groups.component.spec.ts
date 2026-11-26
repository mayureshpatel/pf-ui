import { vi, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { TransactionApiService } from '@features/transactions/services/transaction-api.service';
import { ToastService } from '@core/services/toast.service';
import {
  DescriptionGroup,
  DescriptionGroupPage,
  DescriptionLinkResult,
  Merchant,
} from '@models/merchant.model';
import { MerchantApiService } from '../../services/merchant-api.service';
import {
  CreateForGroup,
  GROUP_PAGE_SIZE,
  UnlinkedGroupsComponent,
} from './unlinked-groups.component';

const RESULT: DescriptionLinkResult = {
  merchantId: 5,
  linkedCount: 1,
  movedCount: 0,
  transactionsFilled: 0,
  linkChanges: [],
  filledTransactionIds: [],
};
const merchant = (id: number, name: string): Merchant => ({
  id,
  userId: 1,
  name,
  city: null,
  state: null,
  postalCode: null,
  country: null,
});
const fuelCenter = merchant(5, 'Kroger Fuel Center');
const group = (
  key: string,
  name: string,
  variants: string[],
  similarKeys: string[] = [],
): DescriptionGroup => ({
  key,
  displayName: name,
  variantCount: variants.length,
  transactionCount: variants.length * 2,
  variants: variants.map((description) => ({
    description,
    transactionCount: 2,
    merchantId: null,
    merchantName: null,
  })),
  similarKeys,
});
const taco = group('taco bell', 'TACO BELL', ['TACO BELL #1', 'TACO BELL #2']);
const fuel = group(
  'kroger fuel ctr',
  'KROGER FUEL CTR',
  ['KROGER FUEL CTR #1', 'KROGER FUEL CTR #2', 'KROGER FUEL CTR #3'],
  ['kroger'],
);
const kroger = group('kroger', 'KROGER', ['KROGER #122'], ['kroger fuel ctr']);
const pageOf = (
  content: DescriptionGroup[],
  total = content.length,
  unlinked = 40,
): DescriptionGroupPage => ({
  content,
  page: { size: GROUP_PAGE_SIZE, number: 0, totalElements: total, totalPages: 1 },
  unlinkedDescriptionCount: unlinked,
});

describe('UnlinkedGroupsComponent', () => {
  let fixture: ComponentFixture<UnlinkedGroupsComponent>;
  let component: UnlinkedGroupsComponent;
  let transactions: Mocked<Pick<TransactionApiService, 'getDescriptionGroups'>>;
  let merchants: Mocked<
    Pick<MerchantApiService, 'suggestMerchants' | 'addDescriptionLinks' | 'getMerchants'>
  >;
  let toast: Mocked<Pick<ToastService, 'success' | 'error'>>;
  let counts: number[];
  let linked: number;
  let creates: CreateForGroup[];

  const text = (): string => fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  const rows = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[role=group]'));
  const names = (): string[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid=group-name]') as NodeListOf<HTMLElement>,
    ).map((e) => e.textContent!.trim());
  const checkboxes = (): HTMLInputElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid=variant-row] input'));
  const key = (target: HTMLElement, k: string): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };
  const create = async (): Promise<void> => {
    fixture = TestBed.createComponent(UnlinkedGroupsComponent);
    component = fixture.componentInstance;
    counts = [];
    linked = 0;
    creates = [];
    component.unlinkedCountChange.subscribe((n: number) => counts.push(n));
    component.linked.subscribe(() => linked++);
    component.createMerchant.subscribe((c: CreateForGroup) => creates.push(c));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    transactions = {
      getDescriptionGroups: vi.fn().mockReturnValue(of(pageOf([taco, fuel, kroger], 30))),
    };
    merchants = {
      suggestMerchants: vi.fn().mockImplementation((names: string[]) =>
        of(
          names.map((name) => ({
            name,
            merchants: name === 'KROGER' ? [merchant(1, 'Kroger')] : [],
          })),
        ),
      ),
      addDescriptionLinks: vi.fn().mockReturnValue(of(RESULT)),
      getMerchants: vi
        .fn()
        .mockReturnValue(
          of({ content: [], page: { totalElements: 0, totalPages: 0, number: 0, size: 50 } }),
        ),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [UnlinkedGroupsComponent],
      providers: [
        { provide: TransactionApiService, useValue: transactions },
        { provide: MerchantApiService, useValue: merchants },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  it('should load the unlinked groups with their counts, a look-alike marker and suggestions', async () => {
    // act
    await create();

    // assert & verify
    expect(transactions.getDescriptionGroups).toHaveBeenCalledWith({
      search: '',
      unlinkedOnly: true,
      page: 0,
      size: GROUP_PAGE_SIZE,
    });
    expect(names()).toEqual(['TACO BELL', 'KROGER FUEL CTR', 'KROGER']);
    expect(text()).toContain('3 of 30 groups shown');
    expect(text()).toContain('3 variants · 6 transactions');
    const markers: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid=similar-marker]'),
    );
    expect(markers).toHaveLength(2);
    expect(markers[0].getAttribute('title')).toBe('Looks like KROGER');
    expect(counts).toEqual([40]);
    expect(merchants.suggestMerchants).toHaveBeenCalledWith(
      ['TACO BELL', 'KROGER FUEL CTR', 'KROGER'],
      5,
    );
    expect(component.suggestionsFor(kroger).map((m) => m.name)).toEqual(['Kroger']);
  });

  it('should show a skeleton while the first load runs', async () => {
    // arrange
    transactions.getDescriptionGroups.mockReturnValue(new Subject<DescriptionGroupPage>());

    // act
    await create();

    // assert & verify
    expect(fixture.nativeElement.querySelector('[data-testid=unlinked-loading]')).not.toBeNull();
  });

  it('should offer Retry when the load fails, and recover', async () => {
    // arrange
    transactions.getDescriptionGroups.mockReturnValueOnce(throwError(() => new Error('down')));
    await create();
    const failed = fixture.nativeElement.querySelector('[data-testid=unlinked-failed]');

    // act
    fixture.nativeElement.querySelector('[data-testid=unlinked-retry]').click();
    fixture.detectChanges();

    // assert & verify
    expect(failed.getAttribute('role')).toBe('alert');
    expect(names()).toEqual(['TACO BELL', 'KROGER FUEL CTR', 'KROGER']);
  });

  it('should say every description is linked when nothing is left, and no match for a search', async () => {
    // arrange
    transactions.getDescriptionGroups.mockReturnValue(of(pageOf([], 0, 0)));
    await create();
    const allLinked: string = text();

    // act
    vi.useFakeTimers();
    component.onSearch('kroger -fuel');
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    fixture.detectChanges();

    // assert & verify
    expect(allLinked).toContain('Every description is linked');
    expect(transactions.getDescriptionGroups).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'kroger -fuel', page: 0 }),
    );
    expect(text()).toContain('No unlinked descriptions match');
  });

  it('should show more by reloading from the top with a bigger page', async () => {
    // arrange
    await create();

    // act
    fixture.nativeElement.querySelector('[data-testid=show-more]').click();

    // assert & verify
    expect(transactions.getDescriptionGroups).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 0, size: 3 + GROUP_PAGE_SIZE }),
    );
  });

  it('should move between groups with the arrows and open and close one with right and left', async () => {
    // arrange
    await create();
    rows()[0].focus();

    // act
    key(rows()[0], 'ArrowDown');
    const moved: Element | null = document.activeElement;
    key(rows()[1], 'ArrowRight');
    const ticks: boolean[] = checkboxes().map((c) => c.checked);
    key(rows()[1], 'ArrowLeft');

    // assert & verify
    expect(moved).toBe(rows()[1]);
    expect(rows().map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    expect(ticks).toEqual([true, true, true]);
    expect(checkboxes()).toHaveLength(0);
  });

  it('should send typing on a row to its merchant field', async () => {
    // arrange
    await create();
    rows()[2].focus();

    // act
    const event = key(rows()[2], 'k');

    // assert & verify
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Merchant for KROGER');
    expect((document.activeElement as HTMLInputElement).value).toBe('k');
  });

  it('should untick a range of variants with a shift-click', async () => {
    // arrange
    await create();
    component.setExpanded(fuel, true);
    fixture.detectChanges();

    // act
    checkboxes()[0].click();
    checkboxes()[2].dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));
    fixture.detectChanges();

    // assert & verify
    expect(checkboxes().map((c) => c.checked)).toEqual([false, false, false]);
    expect(component.tickedVariants(fuel)).toEqual([]);
  });

  it('should link the ticked variants, drop the group and move focus to the next one', async () => {
    // arrange
    await create();
    component.setExpanded(fuel, true);
    fixture.detectChanges();
    checkboxes()[1].click();
    fixture.detectChanges();

    // act
    component.linkGroup(component.groups()[1], fuelCenter);
    fixture.detectChanges();
    await fixture.whenStable();
    const remaining = component.groups()[1];

    // assert & verify
    expect(merchants.addDescriptionLinks).toHaveBeenCalledWith(5, [
      'KROGER FUEL CTR #1',
      'KROGER FUEL CTR #3',
    ]);
    expect(remaining.variants.map((v) => v.description)).toEqual(['KROGER FUEL CTR #2']);
    expect(counts).toEqual([40, 38]);
    expect(linked).toBe(1);
    expect(toast.success).toHaveBeenCalledWith('Linked 2 descriptions to Kroger Fuel Center');

    // act: the variant left over is ticked again and linked, and the group leaves the list
    fixture.detectChanges();
    checkboxes()[0].click();
    component.linkGroup(remaining, fuelCenter);
    fixture.detectChanges();
    await fixture.whenStable();

    // assert & verify
    expect(names()).toEqual(['TACO BELL', 'KROGER']);
    expect(text()).toContain('2 of 29 groups shown');
    expect(counts).toEqual([40, 38, 37]);
    expect(document.activeElement).toBe(rows()[1]);
    expect(transactions.getDescriptionGroups).toHaveBeenCalledTimes(1);
  });

  it('should replace a load that was in flight when a link finished, so the group stays gone', async () => {
    // arrange
    await create();
    const stale = new Subject<DescriptionGroupPage>();
    transactions.getDescriptionGroups.mockReturnValueOnce(stale);
    transactions.getDescriptionGroups.mockReturnValueOnce(of(pageOf([taco, kroger], 29, 37)));
    component.load();

    // act
    component.linkGroup(fuel, fuelCenter);
    stale.next(pageOf([taco, fuel, kroger], 30));
    fixture.detectChanges();

    // assert & verify
    expect(transactions.getDescriptionGroups).toHaveBeenCalledTimes(3);
    expect(stale.observed).toBe(false);
    expect(names()).toEqual(['TACO BELL', 'KROGER']);
  });

  it('should leave focus alone when the user moved it while the link ran', async () => {
    // arrange
    const reply = new Subject<typeof RESULT>();
    merchants.addDescriptionLinks.mockReturnValue(reply);
    await create();
    rows()[1].focus();
    component.linkGroup(fuel, fuelCenter);
    const search: HTMLInputElement = fixture.nativeElement.querySelector('input[type=search]');

    // act
    search.focus();
    reply.next(RESULT);
    reply.complete();
    fixture.detectChanges();
    await fixture.whenStable();

    // assert & verify
    expect(names()).toEqual(['TACO BELL', 'KROGER']);
    expect(document.activeElement).toBe(search);
  });

  it('should start a shift-click range afresh once linked variants leave the group', async () => {
    // arrange
    await create();
    component.setExpanded(fuel, true);
    fixture.detectChanges();
    checkboxes()[0].click();
    checkboxes()[1].click();
    fixture.detectChanges();
    component.linkGroup(component.groups()[1], fuelCenter);
    fixture.detectChanges();
    await fixture.whenStable();

    // act: with no anchor left, a shift-click toggles only the variant clicked
    checkboxes()[0].dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));
    fixture.detectChanges();

    // assert & verify
    expect(checkboxes().map((c) => c.checked)).toEqual([true, false]);
  });

  it('should keep failed variants in the group, still ticked, and say what failed', async () => {
    // arrange
    merchants.addDescriptionLinks.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 400, error: { detail: 'Bad description' } }),
      ),
    );
    await create();

    // act
    component.linkGroup(fuel, fuelCenter);
    fixture.detectChanges();

    // assert & verify
    expect(names()).toContain('KROGER FUEL CTR');
    expect(component.tickedVariants(component.groups()[1])).toHaveLength(3);
    expect(toast.error).toHaveBeenCalledWith('Linked 0, 3 failed: Bad description');
    expect(linked).toBe(0);
  });

  it('should refuse to link a group with nothing ticked', async () => {
    // arrange
    await create();
    component.setExpanded(kroger, true);
    fixture.detectChanges();
    checkboxes()[0].click();

    // act
    component.linkGroup(kroger, fuelCenter);

    // assert & verify
    expect(merchants.addDescriptionLinks).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Tick at least one description to link.');
  });

  it('should ask the host to create a merchant, then offer the new one in that group', async () => {
    // arrange
    await create();

    // act
    component.onCreate(fuel, 'KROGER FUEL CTR');
    component.merchantCreated('kroger fuel ctr', fuelCenter);
    fixture.detectChanges();
    await fixture.whenStable();

    // assert & verify
    expect(creates).toEqual([{ key: 'kroger fuel ctr', name: 'KROGER FUEL CTR' }]);
    expect(component.suggestionsFor(fuel)[0]).toEqual(fuelCenter);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Merchant for KROGER FUEL CTR');
    expect((document.activeElement as HTMLInputElement).value).toBe('Kroger Fuel Center');
  });
});
