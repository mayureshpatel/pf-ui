import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NetWorthMeasure, NetWorthPoint } from '../../models/reports.model';
import { NetWorthChartComponent } from './net-worth-chart.component';

const point = (date: string, assets: number, debts: number): NetWorthPoint => ({
  date,
  assets,
  debts,
  netWorth: assets - debts,
  partial: false,
});
const points = [
  point('2026-08-31', 5820, 300),
  point('2026-09-30', 5970, 400),
  point('2026-10-31', 6000, 400),
];

describe('NetWorthChartComponent (PF-887)', () => {
  let fixture: ComponentFixture<NetWorthChartComponent>;
  let component: NetWorthChartComponent;
  let picked: string[];

  function render(measure: NetWorthMeasure = 'NET_WORTH', month: string | null = null): void {
    fixture.componentRef.setInput('points', points);
    fixture.componentRef.setInput('measure', measure);
    fixture.componentRef.setInput('month', month);
    fixture.detectChanges();
  }
  const datasets = () => component['chartData']().datasets;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NetWorthChartComponent] });
    fixture = TestBed.createComponent(NetWorthChartComponent);
    component = fixture.componentInstance;
    picked = [];
    component.monthSelect.subscribe((m: string) => picked.push(m));
  });

  it('should draw assets above zero, debts below it and net worth as a line', () => {
    // act
    render();

    // assert & verify
    expect(component['chartData']().labels).toEqual(['Aug', 'Sep', 'Oct']);
    expect(datasets().map((d) => d.label)).toEqual(['Assets', 'Debts', 'Net worth']);
    expect(datasets()[0].data).toEqual([5820, 5970, 6000]);
    expect(datasets()[1].data).toEqual([-300, -400, -400]);
    expect(datasets()[2].data).toEqual([5520, 5570, 5600]);
    expect((datasets()[2] as { type?: string }).type).toBe('line');
  });

  it('should plot only the chosen side for Assets or Debts', () => {
    // act & assert
    render('ASSETS');
    expect(datasets().map((d) => d.label)).toEqual(['Assets']);
    render('DEBTS');
    expect(datasets().map((d) => d.label)).toEqual(['Debts']);
  });

  it('should select a month from a click on the chart', () => {
    // arrange
    render();

    // act
    component['onChartSelect']({ element: { index: 1 } });

    // assert & verify
    expect(picked).toEqual(['2026-09']);
  });

  it('should select a month from the labelled select, which is the keyboard route', () => {
    // arrange
    render();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

    // act
    select.value = '2026-08';
    select.dispatchEvent(new Event('change'));

    // assert & verify
    expect(picked).toEqual(['2026-08']);
    expect(
      fixture.nativeElement.querySelector('label[for="net-worth-month"]').textContent,
    ).toContain('Show accounts as of');
  });

  it('should preselect the chosen month, else the last one', () => {
    // act
    render('NET_WORTH', '2026-09');
    const chosen = (fixture.nativeElement.querySelector('select') as HTMLSelectElement).value;
    render('NET_WORTH', null);
    const fallback = (fixture.nativeElement.querySelector('select') as HTMLSelectElement).value;

    // assert & verify
    expect(chosen).toBe('2026-09');
    expect(fallback).toBe('2026-10');
  });

  it('should say how to use it and provide the same numbers in a hidden table', () => {
    // act
    render();

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain(
      "Click a month to see that month's accounts",
    );
    const cells = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('table.sr-only tbody tr'),
    ).map((r) =>
      Array.from(r.children)
        .map((c) => (c.textContent ?? '').trim())
        .join(' '),
    );
    expect(cells[0]).toBe('Aug 2026 $5,820 $300 $5,520');
    expect(cells).toHaveLength(3);
  });

  it('should render nothing for no data', () => {
    // act
    fixture.componentRef.setInput('points', []);
    fixture.componentRef.setInput('measure', 'NET_WORTH');
    fixture.componentRef.setInput('month', null);
    fixture.detectChanges();

    // assert & verify
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
  });
});
