import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Merchant } from '@models/merchant.model';
import { MerchantListComponent } from './merchant-list.component';

const merchant = (id: number, name: string, over: Partial<Merchant> = {}): Merchant => ({
  id,
  userId: 1,
  name,
  city: null,
  state: null,
  postalCode: null,
  country: null,
  linkCount: 0,
  ...over,
});

describe('MerchantListComponent', () => {
  let fixture: ComponentFixture<MerchantListComponent>;
  let component: MerchantListComponent;

  function render(
    over: Partial<{
      merchants: Merchant[];
      selectedId: number | null;
      loading: boolean;
      totalRecords: number;
      page: number;
      pageSize: number;
      searching: boolean;
    }> = {},
  ): void {
    fixture.componentRef.setInput(
      'merchants',
      over.merchants ?? [
        merchant(1, 'Amazon', { city: 'Seattle', state: 'WA', linkCount: 3 }),
        merchant(2, 'Chick-fil-A', { city: 'Atlanta', linkCount: 1 }),
        merchant(3, "Sq *donnie's Donuts"),
      ],
    );
    fixture.componentRef.setInput('selectedId', over.selectedId ?? null);
    fixture.componentRef.setInput('loading', over.loading ?? false);
    fixture.componentRef.setInput('totalRecords', over.totalRecords ?? 3);
    fixture.componentRef.setInput('page', over.page ?? 0);
    fixture.componentRef.setInput('pageSize', over.pageSize ?? 20);
    fixture.componentRef.setInput('searching', over.searching ?? false);
    fixture.detectChanges();
  }
  const all = <T extends HTMLElement>(s: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(s));
  const text = (el: Element | null | undefined): string =>
    (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const button = (name: string): HTMLButtonElement | undefined =>
    all<HTMLButtonElement>('button').find((b) => text(b) === name);

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MerchantListComponent] }).compileComponents();
    fixture = TestBed.createComponent(MerchantListComponent);
    component = fixture.componentInstance;
  });

  it('should show the name, the location and the links on each row', () => {
    // act
    render();

    // assert & verify
    const rows = all('[data-testid="open-merchant"]').map(text);
    expect(rows[0]).toContain('Amazon');
    expect(rows[0]).toContain('Seattle, WA');
    expect(rows[0]).toContain('3 links');
    expect(rows[1]).toContain('Atlanta');
    expect(rows[1]).toContain('1 link');
  });

  it('should show No location and No links for a bare merchant', () => {
    // act
    render();

    // assert & verify
    const row = all('[data-testid="open-merchant"]')[2];
    expect(text(row)).toContain('No location');
    expect(text(row)).toContain('No links');
  });

  it('should treat a missing link count as no links', () => {
    // act
    render({ merchants: [merchant(1, 'Old', { linkCount: undefined })] });

    // assert & verify
    expect(text(all('[data-testid="open-merchant"]')[0])).toContain('No links');
  });

  it('should emit openMerchant when a row is clicked', () => {
    // arrange
    const opened: Merchant[] = [];
    component.openMerchant.subscribe((m: Merchant) => opened.push(m));
    render();

    // act
    all<HTMLButtonElement>('[data-testid="open-merchant"]')[1].click();

    // assert & verify
    expect(opened.map((m) => m.id)).toEqual([2]);
  });

  it('should highlight the selected merchant with a dark variant', () => {
    // act
    render({ selectedId: 2 });

    // assert & verify
    const rows = all('[data-testid="merchant-row"]');
    expect(rows[1].className).toContain('bg-primary-50');
    expect(rows[1].className).toContain('dark:bg-primary-900/30');
    expect(rows[0].className).not.toContain('bg-primary-50');
  });

  it('should dim the rows and mark them busy while loading', () => {
    // act
    render({ loading: true });

    // assert & verify
    const wrapper = all('[data-testid="merchant-list"]')[0];
    expect(wrapper.getAttribute('aria-busy')).toBe('true');
    expect(wrapper.className).toContain('opacity-60');
  });

  it('should not dim anything while idle', () => {
    // act
    render();

    // assert & verify
    const wrapper = all('[data-testid="merchant-list"]')[0];
    expect(wrapper.getAttribute('aria-busy')).toBeNull();
    expect(wrapper.className).not.toContain('opacity-60');
  });

  it('should show both merchants that share a name', () => {
    // act
    render({ merchants: [merchant(1, 'Shell'), merchant(2, 'Shell')] });

    // assert & verify
    expect(all('[data-testid="open-merchant"]')).toHaveLength(2);
  });

  it('should show the range and emit pageChange from the pager', () => {
    // arrange
    const pages: number[] = [];
    component.pageChange.subscribe((p: number) => pages.push(p));
    render({ totalRecords: 312, page: 1 });

    // act
    button('Next page')?.click();
    button('Previous page')?.click();

    // assert & verify
    expect(text(fixture.nativeElement.querySelector('[data-testid="range"]'))).toBe(
      '21 to 40 of 312',
    );
    expect(pages).toEqual([2, 0]);
  });

  it('should disable Previous on the first page and Next on the last', () => {
    // act
    render({ totalRecords: 30, page: 0 });

    // assert & verify
    expect(button('Previous page')?.disabled).toBe(true);
    expect(button('Next page')?.disabled).toBe(false);

    // act
    render({ totalRecords: 30, page: 1 });

    // assert & verify
    expect(text(fixture.nativeElement.querySelector('[data-testid="range"]'))).toBe(
      '21 to 30 of 30',
    );
    expect(button('Next page')?.disabled).toBe(true);
  });

  it('should show the empty search state and emit clearSearch', () => {
    // arrange
    let cleared = 0;
    component.clearSearch.subscribe(() => cleared++);
    render({ merchants: [], totalRecords: 0, searching: true });

    // act
    button('Clear search')?.click();

    // assert & verify
    expect(text(fixture.nativeElement)).toContain('No merchants match your search');
    expect(cleared).toBe(1);
  });

  it('should hide the pager when there are no merchants', () => {
    // act
    render({ merchants: [], totalRecords: 0 });

    // assert & verify
    expect(fixture.nativeElement.querySelector('[data-testid="range"]')).toBeNull();
  });

  // PF-883: colour is not the only cue for the open row
  it('should mark only the selected row with aria-current', () => {
    // act
    render({ selectedId: 2 });

    // assert & verify
    const current = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('[data-testid="open-merchant"]'),
    ).map((b) => b.getAttribute('aria-current'));
    expect(current).toEqual([null, 'true', null]);
  });
});
