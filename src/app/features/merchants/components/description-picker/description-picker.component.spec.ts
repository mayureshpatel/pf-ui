import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionDescription } from '@models/merchant.model';
import { DescriptionPickerComponent } from './description-picker.component';

const row = (
  description: string,
  transactionCount: number,
  merchantId: number | null = null,
  merchantName: string | null = null,
): TransactionDescription => ({ description, transactionCount, merchantId, merchantName });

const rows = [
  row('CHICK-FIL-A #01234', 12),
  row('CHICK-FIL-A 00871', 1),
  row('CFA CATERING', 3, 9, 'Chick-fil-A Corporate'),
  row('Costco', 5, 4, 'Costco'),
];

describe('DescriptionPickerComponent', () => {
  let fixture: ComponentFixture<DescriptionPickerComponent>;
  let component: DescriptionPickerComponent;

  function render(
    over: Partial<{
      rows: TransactionDescription[];
      totalRecords: number;
      linking: boolean;
      failed: string[];
      targetId: number | null;
      loading: boolean;
      unlinkedOnly: boolean;
      loadFailed: boolean;
      backToTarget: boolean;
    }> = {},
  ): void {
    fixture.componentRef.setInput('targetName', 'Chick-fil-A');
    fixture.componentRef.setInput('targetId', over.targetId ?? 4);
    fixture.componentRef.setInput('rows', over.rows ?? rows);
    fixture.componentRef.setInput('totalRecords', over.totalRecords ?? (over.rows ?? rows).length);
    fixture.componentRef.setInput('loading', over.loading ?? false);
    fixture.componentRef.setInput('linking', over.linking ?? false);
    fixture.componentRef.setInput('failed', over.failed ?? []);
    fixture.componentRef.setInput('initialUnlinkedOnly', over.unlinkedOnly ?? false);
    fixture.componentRef.setInput('loadFailed', over.loadFailed ?? false);
    fixture.componentRef.setInput('backToTarget', over.backToTarget ?? true);
    fixture.detectChanges();
  }
  const all = <T extends HTMLElement>(s: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(s));
  const text = (e: Element | null | undefined): string =>
    (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const button = (name: string): HTMLButtonElement | undefined =>
    all<HTMLButtonElement>('button').find((b) => text(b) === name);
  const checkbox = (description: string): HTMLInputElement =>
    all<HTMLInputElement>('input[type="checkbox"]').find(
      (c) => c.getAttribute('aria-label') === `Select ${description}`,
    ) as HTMLInputElement;
  const tick = (description: string): void => {
    checkbox(description).click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DescriptionPickerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DescriptionPickerComponent);
    component = fixture.componentInstance;
  });

  it('should list the descriptions with how many transactions use them', () => {
    // act
    render();

    // assert & verify
    const items = all('[data-testid="description-row"]').map(text);
    expect(items[0]).toContain('CHICK-FIL-A #01234');
    expect(items[0]).toContain('12 transactions');
    expect(items[1]).toContain('1 transaction');
    expect(items[1]).not.toContain('1 transactions');
  });

  it('should tick rows and emit link with the ticked descriptions', () => {
    // arrange
    const linked: string[][] = [];
    component.link.subscribe((d: string[]) => linked.push(d));
    render();

    // act
    tick('CHICK-FIL-A #01234');
    tick('CHICK-FIL-A 00871');
    button('Link 2 descriptions')?.click();

    // assert & verify
    expect(linked).toEqual([['CHICK-FIL-A #01234', 'CHICK-FIL-A 00871']]);
  });

  it('should show the moving text only for a description linked to another merchant', () => {
    // act
    render();

    // assert & verify
    const items = all('[data-testid="description-row"]').map(text);
    expect(items[2]).toContain('Linked to Chick-fil-A Corporate; linking moves it');
    expect(items[3]).toContain('Already linked to Costco');
    expect(items[0]).not.toContain('Linked to');
  });

  it('should leave every row unticked at the start', () => {
    // act
    render();

    // assert & verify
    expect(all<HTMLInputElement>('input[type="checkbox"]').every((c) => !c.checked)).toBe(true);
  });

  it('should disable Link while nothing is ticked or while linking', () => {
    // act
    render();

    // assert & verify
    expect(button('Link descriptions')?.disabled).toBe(true);

    // act
    tick('CHICK-FIL-A #01234');
    render({ linking: true });

    // assert & verify
    expect(button('Linking…')?.disabled).toBe(true);
  });

  it('should keep ticks across new rows, a search and the toggle', () => {
    // arrange
    render();
    tick('CHICK-FIL-A #01234');

    // act -- the host loads a different page of rows that no longer includes the ticked one
    render({ rows: [row('Target', 2)] });
    render();

    // assert & verify
    expect(checkbox('CHICK-FIL-A #01234').checked).toBe(true);
    expect(button('Link 1 description')).toBeDefined();
  });

  it('should keep failed descriptions ticked and clear the others', () => {
    // arrange
    render();
    tick('CHICK-FIL-A #01234');
    tick('CHICK-FIL-A 00871');

    // act
    render({ failed: ['CHICK-FIL-A 00871'] });

    // assert & verify
    expect(checkbox('CHICK-FIL-A #01234').checked).toBe(false);
    expect(checkbox('CHICK-FIL-A 00871').checked).toBe(true);
  });

  it('should emit searchChange, unlinkedOnlyChange and showMore', () => {
    // arrange
    const events: string[] = [];
    component.searchChange.subscribe((s: string) => events.push(`search:${s}`));
    component.unlinkedOnlyChange.subscribe((v: boolean) => events.push(`unlinked:${v}`));
    component.showMore.subscribe(() => events.push('more'));
    render({ totalRecords: 40 });

    // act
    const input = all<HTMLInputElement>('input[aria-label="Search descriptions"]')[0];
    input.value = 'chick';
    input.dispatchEvent(new Event('input'));
    button('Unlinked only')?.click();
    button('Show more')?.click();

    // assert & verify
    expect(events).toEqual(['search:chick', 'unlinked:true', 'more']);
  });

  it('should reflect the unlinked only toggle as pressed', () => {
    // act
    render({ unlinkedOnly: true });

    // assert & verify
    expect(button('Unlinked only')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('should hide Show more when everything is loaded', () => {
    // act
    render();

    // assert & verify
    expect(button('Show more')).toBeUndefined();
  });

  it('should show both empty states', () => {
    // act
    render({ rows: [], totalRecords: 0 });

    // assert & verify
    expect(text(fixture.nativeElement)).toContain('No descriptions match');

    // act
    render({ rows: [], totalRecords: 0, unlinkedOnly: true });

    // assert & verify
    expect(text(fixture.nativeElement)).toContain('Every description is linked.');
  });

  it('should emit back from Back', () => {
    // arrange
    let wentBack = 0;
    component.back.subscribe(() => wentBack++);
    render();

    // act
    button('Back to Chick-fil-A')?.click();

    // assert & verify
    expect(wentBack).toBe(1);
  });

  // PF-883
  it('should say it is loading, not show a blank area, while the first rows load', () => {
    // act
    render({ rows: [], loading: true });

    // assert & verify
    expect(fixture.nativeElement.querySelector('[data-testid="picker-loading"]')).toBeTruthy();
    expect(text(fixture.nativeElement)).toContain('Loading descriptions');
  });

  it('should not show the loading line once rows are there, or the empty message while loading', () => {
    // act
    render({ loading: true });

    // assert & verify -- rows already shown just dim
    expect(fixture.nativeElement.querySelector('[data-testid="picker-loading"]')).toBeNull();

    // act
    render({ rows: [], loading: false });

    // assert & verify
    expect(fixture.nativeElement.querySelector('[data-testid="picker-loading"]')).toBeNull();
  });

  // PF-963: select all, progress and whole-row targets
  it('should tick every shown description that can be linked, then clear them', () => {
    // arrange
    render();

    // act
    button('Select all 3 shown')?.click();
    fixture.detectChanges();

    // assert & verify
    expect(component.tickedCount()).toBe(3);
    expect(button('Clear selection')).toBeTruthy();

    // act
    button('Clear selection')?.click();
    fixture.detectChanges();

    // assert & verify
    expect(component.tickedCount()).toBe(0);
  });

  it('should show how many are shown and how many are still unlinked', () => {
    // arrange
    fixture.componentRef.setInput('unlinkedLeft', 661);

    // act
    render({ totalRecords: 40 });

    // assert & verify
    const progress = fixture.nativeElement.querySelector('[data-testid="picker-progress"]');
    expect(progress.getAttribute('role')).toBe('status');
    expect(text(progress)).toBe('4 of 40 shown · 661 not linked yet');
  });

  it('should make the whole row the click target for its checkbox', () => {
    // arrange
    render();

    // act
    all<HTMLElement>('[data-testid="description-row"] label')[0].click();
    fixture.detectChanges();

    // assert & verify
    expect(component.ticked().has('CHICK-FIL-A #01234')).toBe(true);
  });

  it('should say a load failed, with Retry, instead of claiming every description is linked', () => {
    // arrange
    const retry = vi.fn();
    component.retryLoad.subscribe(retry);

    // act
    render({ rows: [], unlinkedOnly: true, loadFailed: true });
    const failed = fixture.nativeElement.querySelector('[data-testid="picker-failed"]');
    fixture.nativeElement.querySelector('[data-testid="picker-retry"]').click();

    // assert & verify
    expect(failed.getAttribute('role')).toBe('alert');
    expect(text(fixture.nativeElement)).not.toContain('Every description is linked');
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('should show a failed Show more under the rows it kept', () => {
    // act
    render({ totalRecords: 40, loadFailed: true });

    // assert & verify
    expect(all('[data-testid="description-row"]').length).toBe(rows.length);
    expect(fixture.nativeElement.querySelector('[data-testid="picker-failed"]')).not.toBeNull();
  });

  it('should keep Show more focusable while loading and ignore its clicks', () => {
    // arrange
    const more = vi.fn();
    component.showMore.subscribe(more);
    render({ totalRecords: 40, loading: true });

    // act
    button('Show more')?.click();

    // assert & verify
    expect(button('Show more')?.disabled).toBe(false);
    expect(button('Show more')?.getAttribute('aria-disabled')).toBe('true');
    expect(more).not.toHaveBeenCalled();
  });

  it('should label Back as the overview when no merchant is open', () => {
    // act
    render({ backToTarget: false });

    // assert & verify
    expect(button('Back to overview')).toBeDefined();
    expect(button('Back to Chick-fil-A')).toBeUndefined();
  });
});
