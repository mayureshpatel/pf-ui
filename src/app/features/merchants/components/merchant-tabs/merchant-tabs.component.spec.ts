import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MerchantTabsComponent, MerchantView, viewFromParam } from './merchant-tabs.component';

describe('MerchantTabsComponent', () => {
  let fixture: ComponentFixture<MerchantTabsComponent>;
  let chosen: MerchantView[];

  const tabs = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[role=tab]'));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MerchantTabsComponent] });
    fixture = TestBed.createComponent(MerchantTabsComponent);
    fixture.componentRef.setInput('view', 'unlinked');
    fixture.componentRef.setInput('unlinkedCount', 1234);
    chosen = [];
    fixture.componentInstance.viewChange.subscribe((v: MerchantView) => chosen.push(v));
    fixture.detectChanges();
  });

  it('should show Merchants, Unlinked with its count, and Rules, with the active one selected', () => {
    // assert & verify
    expect(tabs().map((t) => t.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Merchants',
      'Unlinked 1,234',
      'Rules',
    ]);
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(tabs().map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });

  it('should hide the count when nothing is unlinked or it is not known yet', () => {
    // act
    fixture.componentRef.setInput('unlinkedCount', 0);
    fixture.detectChanges();
    const atZero = fixture.nativeElement.querySelector('[data-testid=unlinked-badge]');
    fixture.componentRef.setInput('unlinkedCount', null);
    fixture.detectChanges();

    // assert & verify
    expect(atZero).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid=unlinked-badge]')).toBeNull();
  });

  it('should choose a tab on click and move with the arrow keys, Home and End', () => {
    // act
    tabs()[2].click();
    const key = (k: string): void => {
      tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    };
    key('ArrowRight');
    key('ArrowLeft');
    key('Home');
    key('End');

    // assert & verify
    expect(chosen).toEqual(['rules', 'rules', 'merchants', 'merchants', 'rules']);
  });

  it('should read the view from the URL, falling back to the merchants', () => {
    // assert & verify
    expect(viewFromParam('unlinked')).toBe('unlinked');
    expect(viewFromParam(['rules'])).toBe('rules');
    expect(viewFromParam('nope')).toBe('merchants');
    expect(viewFromParam(undefined)).toBe('merchants');
  });
});
