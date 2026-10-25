import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExploreRow, GroupBy, Measure, SortKey } from '../../models/reports.model';
import { ResultsTableComponent } from './results-table.component';

const row = (
  key: string | null,
  label: string,
  value: number | null,
  comparisonValue: number | null = null,
  count = 3,
): ExploreRow => ({ key, label, value, comparisonValue, count });
const rows = (n: number): ExploreRow[] =>
  Array.from({ length: n }, (_, i) => row(String(i + 1), `Row ${i + 1}`, 100 - i, 80 - i, 2));

describe('ResultsTableComponent', () => {
  let fixture: ComponentFixture<ResultsTableComponent>;
  let drilled: ExploreRow[];
  let filtered: ExploreRow[];
  let opened: ExploreRow[];

  function render(
    data: ExploreRow[],
    over: Partial<{
      measure: Measure;
      sort: SortKey;
      search: string;
      expandedOther: boolean;
      loading: boolean;
      groupBy: GroupBy;
    }> = {},
  ): void {
    const groupBy = over.groupBy ?? 'CATEGORY';
    fixture.componentRef.setInput('rows', data);
    fixture.componentRef.setInput('measure', over.measure ?? 'SPENDING');
    fixture.componentRef.setInput('sort', over.sort ?? 'value');
    fixture.componentRef.setInput('search', over.search ?? '');
    fixture.componentRef.setInput('expandedOther', over.expandedOther ?? false);
    fixture.componentRef.setInput('loading', over.loading ?? false);
    fixture.componentRef.setInput('groupBy', groupBy);
    fixture.componentRef.setInput('groupLabel', groupBy === 'TAG' ? 'Tag' : 'Category');
    fixture.detectChanges();
  }

  const names = (): string[] =>
    (
      Array.from(fixture.nativeElement.querySelectorAll('[data-row] [data-name]')) as HTMLElement[]
    ).map((e) => e.textContent!.trim());

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ResultsTableComponent, NoopAnimationsModule] });
    fixture = TestBed.createComponent(ResultsTableComponent);
    drilled = [];
    filtered = [];
    opened = [];
    fixture.componentInstance.drill.subscribe((r: ExploreRow) => drilled.push(r));
    fixture.componentInstance.filterOnly.subscribe((r: ExploreRow) => filtered.push(r));
    fixture.componentInstance.openTransactions.subscribe((r: ExploreRow) => opened.push(r));
  });

  it('should show share bars with a comparison tick', () => {
    // act
    render([row('1', 'Food', 100, 50), row('2', 'Rent', 50, null)]);

    // assert & verify
    const bars: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-bar]'));
    const ticks: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-tick]'));
    expect(bars.map((b) => b.style.width)).toEqual(['100%', '50%']);
    expect(ticks).toHaveLength(1);
    expect(ticks[0].style.left).toBe('50%');
  });

  it('should show change text with the right tone per measure', () => {
    // act
    render([row('1', 'Food', 118.7, 100)], { measure: 'SPENDING' });
    const spending = fixture.nativeElement.querySelector('[data-change]');
    const spendingTone = spending.getAttribute('data-tone');
    const spendingText = spending.textContent.trim();
    render([row('1', 'Salary', 118.7, 100)], { measure: 'INCOME' });
    const income = fixture.nativeElement.querySelector('[data-change]');

    // assert & verify
    expect(spendingText).toBe('▲ up 18.7%');
    expect(spendingTone).toBe('bad');
    expect(income.getAttribute('data-tone')).toBe('good');
  });

  it('should leave the change column out when nothing is compared', () => {
    // act
    render([row('1', 'Food', 100, null)]);

    // assert & verify
    expect(fixture.nativeElement.querySelector('[data-change]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-tick]')).toBeNull();
  });

  it('should keep Uncategorized, No merchant and No tag rows visible', () => {
    // act
    render([...rows(12), row(null, 'Uncategorized', 1)]);

    // assert & verify
    expect(names()).toContain('Uncategorized');
    expect(names()).toHaveLength(11);
    expect(fixture.nativeElement.textContent).toContain('Other (2 more)');
  });

  it('should collapse beyond ten rows into Other and expand it', () => {
    // arrange
    let toggled = 0;
    fixture.componentInstance.toggleOther.subscribe(() => toggled++);
    render(rows(13));

    // act
    const collapsed = names().length;
    (fixture.nativeElement.querySelector('[data-other] button') as HTMLButtonElement).click();
    render(rows(13), { expandedOther: true });

    // assert & verify
    expect(collapsed).toBe(10);
    expect(toggled).toBe(1);
    expect(names()).toHaveLength(13);
    expect(fixture.nativeElement.querySelector('[data-other]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Show fewer');
  });

  it('should filter by the search text', () => {
    // act
    render([row('1', 'Food', 10), row('2', 'Fuel', 20), row('3', 'Rent', 30)], { search: 'fu' });

    // assert & verify
    expect(names()).toEqual(['Fuel']);
  });

  it('should sort by total, change, name and count', () => {
    // arrange
    const data = [
      row('1', 'Banana', 10, 9, 5),
      row('2', 'Apple', 30, 29, 1),
      row('3', 'Cherry', 20, 5, 3),
    ];

    // act
    render(data, { sort: 'value' });
    const byValue = names();
    render(data, { sort: 'change' });
    const byChange = names();
    render(data, { sort: 'name' });
    const byName = names();
    render(data, { sort: 'count' });
    const byCount = names();

    // assert & verify
    expect(byValue).toEqual(['Apple', 'Cherry', 'Banana']);
    expect(byChange).toEqual(['Cherry', 'Apple', 'Banana']);
    expect(byName).toEqual(['Apple', 'Banana', 'Cherry']);
    expect(byCount).toEqual(['Banana', 'Cherry', 'Apple']);
  });

  it('should order time groupings by date when sorted by name', () => {
    // act
    render([row('2026-03-01', 'Mar 2026', 5), row('2026-01-01', 'Jan 2026', 9)], {
      groupBy: 'MONTH',
      sort: 'name',
    });

    // assert & verify
    expect(names()).toEqual(['Jan 2026', 'Mar 2026']);
  });

  it('should emit sort and search changes', () => {
    // arrange
    const sorts: SortKey[] = [];
    const searches: string[] = [];
    fixture.componentInstance.sortChange.subscribe((s: SortKey) => sorts.push(s));
    fixture.componentInstance.searchChange.subscribe((s: string) => searches.push(s));
    render(rows(3));

    // act
    fixture.debugElement
      .query(By.css('#results-sort'))
      .triggerEventHandler('onChange', { value: 'name' });
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#results-search');
    input.value = 'row';
    input.dispatchEvent(new Event('input'));

    // assert & verify
    expect(sorts).toEqual(['name']);
    expect(searches).toEqual(['row']);
  });

  it('should emit drill on a row click and the menu actions', () => {
    // arrange
    const data = [row('5', 'Food', 100)];
    render(data);

    // act
    (fixture.nativeElement.querySelector('[data-row] [data-name]') as HTMLButtonElement).click();
    const menuButton = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('[data-row] [data-menu]');
    const item = (text: string): HTMLButtonElement =>
      (
        Array.from(
          fixture.nativeElement.querySelectorAll('[role="menuitem"]'),
        ) as HTMLButtonElement[]
      ).find((b) => b.textContent?.includes(text))!;
    menuButton().click();
    fixture.detectChanges();
    const labels = (
      Array.from(fixture.nativeElement.querySelectorAll('[role="menuitem"]')) as HTMLElement[]
    ).map((e) => e.textContent!.replace(/\s+/g, ' ').trim());
    item('Drill into').click();
    fixture.detectChanges();
    menuButton().click();
    fixture.detectChanges();
    item('Filter to').click();
    fixture.detectChanges();
    menuButton().click();
    fixture.detectChanges();
    item('Open transactions').click();
    fixture.detectChanges();

    // assert & verify
    expect(labels).toEqual([
      'Drill into Food',
      'Filter to Food and keep grouping by Category',
      'Open transactions',
    ]);
    expect(drilled).toEqual([data[0], data[0]]);
    expect(filtered).toEqual([data[0]]);
    expect(opened).toEqual([data[0]]);
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });

  it('should close the menu on Escape', () => {
    // arrange
    render([row('5', 'Food', 100)]);
    (fixture.nativeElement.querySelector('[data-menu]') as HTMLButtonElement).click();
    fixture.detectChanges();

    // act
    (fixture.nativeElement.querySelector('[role="menu"]') as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();

    // assert & verify
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });

  it('should not offer to drill a day of the week, which cannot be filtered on', () => {
    // act
    render([row('3', 'Wednesday', 100)], { groupBy: 'DAY_OF_WEEK' });

    // assert & verify
    expect(fixture.nativeElement.querySelector('[data-row] button[data-name]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-menu]')).toBeNull();
    expect(names()).toEqual(['Wednesday']);
  });

  it('should dim and mark busy while loading', () => {
    // act
    render(rows(2), { loading: true });

    // assert & verify
    const busy: HTMLElement = fixture.nativeElement.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
    expect(busy.className).toContain('opacity-60');
  });

  it('should show the tag note only for a tag grouping', () => {
    // act
    render(rows(2), { groupBy: 'TAG' });
    const withNote = fixture.nativeElement.textContent;
    render(rows(2), { groupBy: 'CATEGORY' });

    // assert & verify
    expect(withNote).toContain('appears under each of its tags');
    expect(fixture.nativeElement.textContent).not.toContain('appears under each of its tags');
  });

  it('should show a dash for a measure without a value', () => {
    // act
    render([row('1', 'Jan', null)], { measure: 'SAVINGS_RATE', groupBy: 'MONTH' });

    // assert & verify
    expect(fixture.nativeElement.querySelector('[data-value]').textContent.trim()).toBe('—');
  });
});
