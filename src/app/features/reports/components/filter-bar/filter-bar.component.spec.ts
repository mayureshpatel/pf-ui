import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Account } from '@models/account.model';
import { Category } from '@models/category.model';
import { Merchant } from '@models/merchant.model';
import { Tag } from '@models/tag.model';
import { DrillStep, ExploreFilters } from '../../models/reports.model';
import { FilterBarComponent } from './filter-bar.component';

const accounts = [
  { id: 1, name: 'Checking' },
  { id: 2, name: 'Savings' },
] as Account[];
const categories = [
  { id: 5, name: 'Food', parent: null },
  { id: 8, name: 'Groceries', parent: { id: 5, name: 'Food' } },
] as Category[];
const merchants = [{ id: 9, name: 'Whole Foods' }] as Merchant[];
const tags = [{ id: 3, name: 'Trip' }] as Tag[];
const FOOD: DrillStep = { groupBy: 'CATEGORY', filterKey: 'categoryId', label: 'Food', value: 5 };

describe('FilterBarComponent', () => {
  let fixture: ComponentFixture<FilterBarComponent>;
  let filterChanges: ExploreFilters[];
  let removed: number[];
  let searches: string[];

  function render(
    filters: Partial<ExploreFilters> = {},
    drill: DrillStep[] = [],
    excluded = 0,
  ): void {
    fixture.componentRef.setInput('filters', { accountIds: [], ...filters });
    fixture.componentRef.setInput('drill', drill);
    fixture.componentRef.setInput('excluded', excluded);
    fixture.componentRef.setInput('accounts', accounts);
    fixture.componentRef.setInput('categories', categories);
    fixture.componentRef.setInput('merchants', merchants);
    fixture.componentRef.setInput('tags', tags);
    fixture.detectChanges();
  }

  const chips = (): string[] =>
    (Array.from(fixture.nativeElement.querySelectorAll('[data-chip]')) as HTMLElement[]).map((c) =>
      c.querySelector('.chip-label')!.textContent!.trim(),
    );

  const pick = (id: string, value: unknown): void => {
    fixture.debugElement.query(By.css(`#${id}`)).triggerEventHandler('onChange', { value });
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FilterBarComponent, NoopAnimationsModule] });
    fixture = TestBed.createComponent(FilterBarComponent);
    filterChanges = [];
    removed = [];
    searches = [];
    fixture.componentInstance.filtersChange.subscribe((f: ExploreFilters) => filterChanges.push(f));
    fixture.componentInstance.removeDrill.subscribe((i: number) => removed.push(i));
    fixture.componentInstance.merchantSearch.subscribe((q: string) => searches.push(q));
  });

  it('should render drill and filter chips as one list', () => {
    // act
    render({ accountIds: [1], categoryId: 5, categoryName: 'Food', minAmount: 10, noTag: true }, [
      FOOD,
    ]);

    // assert & verify
    expect(chips()).toEqual([
      'Category: Food',
      'Account: Checking',
      'No tag',
      'Amount: at least $10',
    ]);
  });

  it('should name several accounts, a merchant, a tag and an amount range', () => {
    // act
    render({
      accountIds: [1, 2],
      merchantId: 9,
      merchantName: 'Whole Foods',
      tagId: 3,
      minAmount: 5,
      maxAmount: 500,
      uncategorized: true,
      noMerchant: true,
    });
    fixture.componentInstance['expanded'].set(true);
    fixture.detectChanges();

    // assert & verify
    expect(chips()).toEqual([
      'Accounts: Checking, Savings',
      'Uncategorized',
      'Merchant: Whole Foods',
      'No merchant',
      'Tag: Trip',
      'Amount: $5 to $500',
    ]);
  });

  it('should remove a filter chip or step back for a drill chip', () => {
    // arrange
    render({ accountIds: [1], categoryId: 5, categoryName: 'Food' }, [FOOD]);

    // act
    const remove = (label: string): void =>
      (
        fixture.nativeElement.querySelector(
          `button[aria-label="Remove ${label}"]`,
        ) as HTMLButtonElement
      ).click();
    remove('Account: Checking');
    remove('Category: Food');

    // assert & verify
    expect(filterChanges).toEqual([{ accountIds: [], categoryId: 5, categoryName: 'Food' }]);
    expect(removed).toEqual([0]);
  });

  it('should collapse beyond four chips and expand on request', () => {
    // arrange
    render({
      accountIds: [1],
      uncategorized: true,
      noMerchant: true,
      noTag: true,
      minAmount: 1,
      maxAmount: 2,
    });

    // act
    const more = (): HTMLButtonElement | undefined =>
      (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
        (b) => b.textContent?.includes('more'),
      );
    const collapsed = chips().length;
    expect(more()?.textContent?.trim()).toBe('+1 more');
    more()!.click();
    fixture.detectChanges();

    // assert & verify
    expect(collapsed).toBe(4);
    expect(chips()).toHaveLength(5);
    expect(more()).toBeUndefined();
  });

  it('should show the excluded note', () => {
    // act
    render({}, [], 38);

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('Transfers excluded, 38 left out');
  });

  it('should say transfers are excluded when none were left out', () => {
    // act
    render({}, [], 0);

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('Transfers excluded');
    expect(fixture.nativeElement.textContent).not.toContain('left out');
  });

  const add = (kind: string, value: unknown): void => {
    if (!fixture.nativeElement.querySelector('#add-kind')) {
      (fixture.nativeElement.querySelector('#add-filter') as HTMLButtonElement).click();
      fixture.detectChanges();
    }
    pick('add-kind', kind);
    pick('add-value', value);
  };

  it('should emit filters from the add menu and close it', () => {
    // arrange
    render({ accountIds: [1] });

    // act
    add('tag', 3);
    const closed = fixture.nativeElement.querySelector('#add-kind') === null;
    add('category', 8);
    add('merchant', 'none');
    add('account', [1, 2]);

    // assert & verify
    expect(closed).toBe(true);
    expect(filterChanges[0]).toEqual({ accountIds: [1], tagId: 3 });
    expect(filterChanges[1]).toEqual({ accountIds: [1], categoryId: 8, categoryName: 'Groceries' });
    expect(filterChanges[2]).toEqual({ accountIds: [1], noMerchant: true });
    expect(filterChanges[3]).toEqual({ accountIds: [1, 2] });
  });

  it('should replace the "none" choice with a real one', () => {
    // arrange
    render({ accountIds: [], noMerchant: true, uncategorized: true });

    // act
    add('merchant', 9);
    add('category', 'none');

    // assert & verify
    expect(filterChanges[0]).toEqual({
      accountIds: [],
      uncategorized: true,
      merchantId: 9,
      merchantName: 'Whole Foods',
    });
    expect(filterChanges[1]).toEqual({ accountIds: [], noMerchant: true, uncategorized: true });
  });

  it('should emit an amount range from the add menu', () => {
    // arrange
    render();
    (fixture.nativeElement.querySelector('#add-filter') as HTMLButtonElement).click();
    fixture.detectChanges();
    pick('add-kind', 'amount');

    // act
    const min: HTMLInputElement = fixture.nativeElement.querySelector('#add-min');
    const max: HTMLInputElement = fixture.nativeElement.querySelector('#add-max');
    min.value = '10';
    min.dispatchEvent(new Event('input'));
    max.value = '250';
    max.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('#add-apply') as HTMLButtonElement).click();

    // assert & verify
    expect(filterChanges).toEqual([{ accountIds: [], minAmount: 10, maxAmount: 250 }]);
  });

  it('should pass a merchant search up for the host to look up', () => {
    // arrange
    render();
    (fixture.nativeElement.querySelector('#add-filter') as HTMLButtonElement).click();
    fixture.detectChanges();
    pick('add-kind', 'merchant');

    // act
    fixture.debugElement
      .query(By.css('#add-value'))
      .triggerEventHandler('onFilter', { filter: 'whole' });

    // assert & verify
    expect(searches).toEqual(['whole']);
  });
});
