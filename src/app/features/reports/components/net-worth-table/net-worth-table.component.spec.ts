import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NetWorthGroup } from '../../models/reports.model';
import { NetWorthTableComponent } from './net-worth-table.component';

const group = (over: Partial<NetWorthGroup> = {}): NetWorthGroup => ({
  key: 'SAVINGS',
  label: 'Savings',
  kind: 'ASSET',
  typeCode: 'SAVINGS',
  accountCount: 2,
  balance: 42900,
  previousBalance: 40320,
  comparisonBalance: null,
  series: [40000, 41000, 42900],
  story: null,
  ...over,
});
const card = group({
  key: 'CREDIT_CARD',
  label: 'Credit cards',
  kind: 'DEBT',
  typeCode: 'CREDIT_CARD',
  balance: -43470,
  previousBalance: -47820,
  series: [-47820, -43470],
});

describe('NetWorthTableComponent (PF-887)', () => {
  let fixture: ComponentFixture<NetWorthTableComponent>;
  let component: NetWorthTableComponent;
  let opened: NetWorthGroup[];

  function render(
    groups: NetWorthGroup[],
    groupBy: 'TYPE' | 'ACCOUNT' = 'TYPE',
    label: string | null = null,
  ): void {
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('groupBy', groupBy);
    fixture.componentRef.setInput('totalAssets', 171900);
    fixture.componentRef.setInput('compareLabel', label);
    fixture.detectChanges();
  }
  const rows = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid="group-row"]'));
  const text = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NetWorthTableComponent] });
    fixture = TestBed.createComponent(NetWorthTableComponent);
    component = fixture.componentInstance;
    opened = [];
    component.openGroup.subscribe((g: NetWorthGroup) => opened.push(g));
  });

  it('should list groups as buttons with balance, change and trend', () => {
    // act
    render([group()]);

    // assert & verify
    const row = rows()[0];
    expect(row.querySelector('button')?.textContent).toContain('Savings');
    expect(text(row)).toContain('$42,900');
    expect(text(row)).toContain('▲ up 6.4%');
    expect(row.querySelector('svg path')?.getAttribute('d')).toMatch(/^M/);
  });

  it('should show debts in their own colour with a minus balance and a debt wording', () => {
    // act
    render([group(), card]);

    // assert & verify
    const debt = rows()[1];
    expect(text(debt)).toContain('-$43,470');
    expect(text(debt)).toContain('▼ debt down 9.1%');
    expect(debt.querySelector('[data-bar]')?.className).toContain('bg-rose-');
    expect(rows()[0].querySelector('[data-bar]')?.className).toContain('bg-primary-');
  });

  it('should size an asset bar by its share of all assets', () => {
    // act
    render([group({ balance: 85950 })]);

    // assert & verify
    expect((rows()[0].querySelector('[data-bar]') as HTMLElement).style.width).toBe('50%');
  });

  it('should give a one-point series no trend line', () => {
    // act
    render([group({ series: [42900] })]);

    // assert & verify
    expect(rows()[0].querySelector('svg path')).toBeNull();
  });

  it('should name what the change is against in the heading', () => {
    // act
    render([group()], 'TYPE', 'a year ago');

    // assert & verify
    expect(text(fixture.nativeElement.querySelector('thead'))).toContain('vs a year ago');
    render([group()], 'ACCOUNT', null);
    expect(text(fixture.nativeElement.querySelector('thead'))).toContain('Account');
    expect(text(fixture.nativeElement.querySelector('thead'))).toContain('over the range');
  });

  it('should emit the clicked group', () => {
    // arrange
    render([group(), card]);

    // act
    (rows()[1].querySelector('button') as HTMLButtonElement).click();

    // assert & verify
    expect(opened).toEqual([card]);
  });

  it('should say when there is nothing to list', () => {
    // act
    render([]);

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('No accounts to show');
  });
});
