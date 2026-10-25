import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExploreState } from '../../models/reports.model';
import { defaultState } from '../../utils/explore-state';
import { ExplorerControlsComponent } from './explorer-controls.component';

describe('ExplorerControlsComponent', () => {
  let fixture: ComponentFixture<ExplorerControlsComponent>;
  let emitted: Partial<ExploreState>[];

  function render(over: Partial<ExploreState> = {}): void {
    fixture.componentRef.setInput('state', { ...defaultState(new Date(2026, 9, 25)), ...over });
    fixture.detectChanges();
  }

  const button = (label: string): HTMLButtonElement =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim() === label,
    ) as HTMLButtonElement;

  const select = (id: string, value: unknown): void => {
    fixture.debugElement.query(By.css(`#${id}`)).triggerEventHandler('onChange', { value });
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ExplorerControlsComponent, NoopAnimationsModule] });
    fixture = TestBed.createComponent(ExplorerControlsComponent);
    emitted = [];
    fixture.componentInstance.stateChange.subscribe((c: Partial<ExploreState>) => emitted.push(c));
  });

  it('should pressed-mark the active measure', () => {
    // act
    render({ measure: 'INCOME' });

    // assert & verify
    expect(button('Income').getAttribute('aria-pressed')).toBe('true');
    expect(button('Spending').getAttribute('aria-pressed')).toBe('false');
    expect(button('Net').getAttribute('aria-pressed')).toBe('false');
  });

  it('should emit the measure that was pressed', () => {
    // arrange
    render();

    // act
    button('Income').click();

    // assert & verify
    expect(emitted).toEqual([{ measure: 'INCOME' }]);
  });

  it('should disable groupings a measure does not allow, with the reason', () => {
    // act
    render({ measure: 'NET', groupBy: 'MONTH' });

    // assert & verify
    const options = fixture.componentInstance['groupByOptions']();
    const category = options.find((o) => o.value === 'CATEGORY');
    const month = options.find((o) => o.value === 'MONTH');
    expect(category?.disabled).toBe(true);
    expect(category?.reason).toBe(
      'Net is income minus spending, so it only makes sense over time.',
    );
    expect(month?.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('#explore-group-by-hint').textContent).toContain(
      'only makes sense over time',
    );
  });

  it('should only offer Subcategory once a category is chosen', () => {
    // act
    render();
    const before = fixture.componentInstance['groupByOptions']().map((o) => o.value);
    render({ filters: { accountIds: [], categoryId: 5, categoryName: 'Food' } });
    const after = fixture.componentInstance['groupByOptions']().map((o) => o.value);

    // assert & verify
    expect(before).not.toContain('SUBCATEGORY');
    expect(after).toContain('SUBCATEGORY');
  });

  it('should switch to Month and note it when the measure rules out the grouping', () => {
    // arrange
    render({ groupBy: 'CATEGORY' });

    // act
    button('Net').click();
    fixture.detectChanges();

    // assert & verify
    expect(emitted).toEqual([{ measure: 'NET', groupBy: 'MONTH' }]);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Net only makes sense over time, so the grouping switched to Month.',
    );
  });

  it('should keep the grouping when the measure allows it and clear an old note', () => {
    // arrange
    render({ groupBy: 'CATEGORY' });
    button('Net').click();
    fixture.detectChanges();

    // act
    render({ measure: 'NET', groupBy: 'MONTH' });
    button('Income').click();
    fixture.detectChanges();

    // assert & verify
    expect(emitted[1]).toEqual({ measure: 'INCOME' });
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });

  it('should show the side toggle only for Count and Average', () => {
    // act
    render({ measure: 'SPENDING' });
    const hidden = fixture.nativeElement.querySelector('[aria-label="Count and average look at"]');
    render({ measure: 'COUNT' });
    const shown = fixture.nativeElement.querySelector('[aria-label="Count and average look at"]');
    (shown.querySelector('button:last-child') as HTMLButtonElement).click();

    // assert & verify
    expect(hidden).toBeNull();
    expect(shown).not.toBeNull();
    expect(emitted).toContainEqual({ side: 'INCOME' });
  });

  it('should emit range, compare and group changes', () => {
    // arrange
    render();

    // act
    select('explore-range', 'this-month');
    select('explore-compare', 'PREVIOUS_PERIOD');
    select('explore-group-by', 'MERCHANT');

    // assert & verify
    expect(emitted[0]).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      rangeLabel: 'This month',
    });
    expect(emitted[1]).toEqual({ compare: 'PREVIOUS_PERIOD' });
    expect(emitted[2]).toEqual({ groupBy: 'MERCHANT', leaf: false });
  });

  it('should apply a start view', () => {
    // arrange
    render();

    // act
    button('Biggest movers').click();

    // assert & verify
    expect(emitted).toHaveLength(1);
    expect(emitted[0].compare).toBe('SAME_DAYS_LAST_YEAR');
    expect(emitted[0].sort).toBe('change');
    expect(emitted[0].groupBy).toBe('CATEGORY');
    expect(emitted[0].drill).toEqual([]);
  });

  it('should show custom date inputs for a custom range and emit valid dates', () => {
    // arrange
    render();
    expect(fixture.nativeElement.querySelector('#explore-start')).toBeNull();

    // act
    select('explore-range', 'custom');
    const start: HTMLInputElement = fixture.nativeElement.querySelector('#explore-start');
    const end: HTMLInputElement = fixture.nativeElement.querySelector('#explore-end');
    start.value = '2026-03-05';
    start.dispatchEvent(new Event('change'));
    end.value = '2026-03-02';
    end.dispatchEvent(new Event('change'));
    end.value = '2026-03-20';
    end.dispatchEvent(new Event('change'));

    // assert & verify
    expect(start).not.toBeNull();
    expect(emitted).toEqual([
      { startDate: '2026-03-05', endDate: '2026-12-31', rangeLabel: 'Custom' },
      { startDate: '2026-03-05', endDate: '2026-03-20', rangeLabel: 'Custom' },
    ]);
  });
});
