import {ComponentFixture, TestBed} from '@angular/core/testing';
import {SummaryCardsComponent} from './summary-cards.component';
import {DashboardData} from '@models/dashboard.model';

describe('SummaryCardsComponent', () => {
  let component: SummaryCardsComponent;
  let fixture: ComponentFixture<SummaryCardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SummaryCardsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SummaryCardsComponent);
    component = fixture.componentInstance;
  });

  it("bug regression: should not throw when data is null -- the input's own type "
      + '(InputSignal<DashboardData | null>) explicitly allows it, but the template used a '
      + "non-null assertion (data()!) everywhere instead of a real null guard, so the type system's "
      + "own promise of safety didn't hold at runtime", () => {
    // arrange
    fixture.componentRef.setInput('data', null);

    // act & assert & verify
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('should render all three card values given real data', () => {
    // arrange
    const data: DashboardData = {totalIncome: 5000, totalExpense: 3200, netSavings: 1800, categoryBreakdown: []};
    fixture.componentRef.setInput('data', data);

    // act
    fixture.detectChanges();

    // assert & verify
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('$5,000.00');
    expect(text).toContain('$3,200.00');
    expect(text).toContain('$1,800.00');
  });

  it('should style net savings as positive (non-red) when non-negative', () => {
    // arrange
    const data: DashboardData = {totalIncome: 5000, totalExpense: 3200, netSavings: 1800, categoryBreakdown: []};
    fixture.componentRef.setInput('data', data);

    // act
    fixture.detectChanges();

    // assert & verify
    const netSavingsEl = fixture.nativeElement.querySelectorAll('p.text-2xl')[2];
    expect(netSavingsEl.className).toContain('text-primary-600');
    expect(netSavingsEl.className).not.toContain('text-red-600');
  });

  it('should style net savings as negative (red) when spending exceeded income', () => {
    // arrange
    const data: DashboardData = {totalIncome: 2000, totalExpense: 3200, netSavings: -1200, categoryBreakdown: []};
    fixture.componentRef.setInput('data', data);

    // act
    fixture.detectChanges();

    // assert & verify
    const netSavingsEl = fixture.nativeElement.querySelectorAll('p.text-2xl')[2];
    expect(netSavingsEl.className).toContain('text-red-600');
    expect(netSavingsEl.className).not.toContain('text-primary-600');
  });
});
