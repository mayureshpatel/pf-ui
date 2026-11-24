import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExploreTrend, Measure, TrendBucket } from '../../models/reports.model';
import { TrendChartComponent } from './trend-chart.component';

const bucket = (start: string, value: number | null, partial = false): TrendBucket => ({
  start,
  value,
  partial,
});
const MONTHS: ExploreTrend = {
  current: [bucket('2026-01-01', 100), bucket('2026-02-01', 50), bucket('2026-03-01', 75, true)],
  comparison: [bucket('2025-01-01', 80), bucket('2025-02-01', 60), bucket('2025-03-01', 90)],
};

describe('TrendChartComponent', () => {
  let fixture: ComponentFixture<TrendChartComponent>;

  function render(
    trend: ExploreTrend | null,
    measure: Measure = 'SPENDING',
    loading = false,
    trimEmpty = false,
  ): void {
    fixture.componentRef.setInput('trend', trend);
    fixture.componentRef.setInput('trimEmpty', trimEmpty);
    fixture.componentRef.setInput('measure', measure);
    fixture.componentRef.setInput('loading', loading);
    fixture.detectChanges();
  }

  const bars = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('button[data-bar]'));

  const fills = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-fill]'));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TrendChartComponent] });
    fixture = TestBed.createComponent(TrendChartComponent);
  });

  it('should render a button per bucket, labelled with its period and value', () => {
    // act
    render(MONTHS);

    // assert & verify
    expect(bars()).toHaveLength(3);
    expect(bars()[0].getAttribute('aria-label')).toBe('Jan 2026: $100.00');
    expect(fills()[0].style.height).toBe('100%');
    expect(fills()[1].style.height).toBe('50%');
  });

  // PF-894
  it('should label buckets by the granularity the server sent, even for a single bucket', () => {
    // arrange
    const one = (start: string, granularity: 'day' | 'week' | 'month'): ExploreTrend => ({
      current: [bucket(start, 10)],
      comparison: [],
      granularity,
    });

    // act & assert -- 2026-11-01 alone would be guessed as a month
    render(one('2026-11-01', 'day'));
    expect(bars()[0].getAttribute('aria-label')).toBe('Nov 1: $10.00');
    render(one('2026-11-02', 'week'));
    expect(bars()[0].getAttribute('aria-label')).toBe('Week of Nov 2: $10.00');
    render(one('2026-11-01', 'month'));
    expect(bars()[0].getAttribute('aria-label')).toBe('Nov 2026: $10.00');
  });

  it('should trust the server over the spacing of the buckets', () => {
    // act -- two buckets a week apart, but the server says day
    render({
      current: [bucket('2026-03-02', 1), bucket('2026-03-09', 2)],
      comparison: [],
      granularity: 'day',
    });

    // assert & verify
    expect(bars()[1].getAttribute('aria-label')).toBe('Mar 9: $2.00');
  });

  it('should stripe the partial bucket and say it is in progress', () => {
    // act
    render(MONTHS);

    // assert & verify
    expect(bars()[2].hasAttribute('data-partial')).toBe(true);
    expect(bars()[2].getAttribute('aria-label')).toBe('Mar 2026: $75.00, in progress');
    expect(bars()[0].hasAttribute('data-partial')).toBe(false);
  });

  it('should draw the comparison outline for each bucket that has one', () => {
    // act
    render(MONTHS);
    const outlines: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-comparison]'),
    );
    render({ current: MONTHS.current, comparison: [] });

    // assert & verify
    expect(outlines).toHaveLength(3);
    expect(outlines[2].style.height).toBe('90%');
    expect(fixture.nativeElement.querySelectorAll('[data-comparison]')).toHaveLength(0);
  });

  it('should emit the clicked bucket', () => {
    // arrange
    const emitted: TrendBucket[] = [];
    fixture.componentInstance.selectBucket.subscribe((b: TrendBucket) => emitted.push(b));
    render(MONTHS);

    // act
    bars()[1].click();

    // assert & verify
    expect(emitted).toEqual([MONTHS.current[1]]);
  });

  it('should expose a table equivalent', () => {
    // act
    render(MONTHS);

    // assert & verify
    const rows = fixture.nativeElement.querySelectorAll('table.sr-only tbody tr');
    expect(rows).toHaveLength(3);
    expect(
      Array.from(rows[0].querySelectorAll('th,td')).map((c) =>
        (c as HTMLElement).textContent!.trim(),
      ),
    ).toEqual(['Jan 2026', '$100.00', '$80.00']);
  });

  it('should drop empty buckets from the start only when asked, such as for all time', () => {
    // arrange
    const empty: ExploreTrend = {
      current: [
        bucket('2025-11-01', 0),
        bucket('2025-12-01', 0),
        bucket('2026-01-01', 40),
        bucket('2026-02-01', 0),
      ],
      comparison: [],
    };

    // act
    render(empty);
    const untrimmed = bars().length;
    render(empty, 'SPENDING', false, true);

    // assert & verify
    expect(untrimmed).toBe(4);
    expect(bars().map((b) => b.getAttribute('aria-label')?.split(':')[0])).toEqual([
      'Jan 2026',
      'Feb 2026',
    ]);
  });

  it('should mark busy and dim while loading, and show nothing without data', () => {
    // act
    render(MONTHS, 'SPENDING', true);
    const busy = fixture.nativeElement.querySelector('[aria-busy="true"]');
    render(null);

    // assert & verify
    expect(busy).not.toBeNull();
    expect(bars()).toHaveLength(0);
  });

  it('should show a savings rate bucket without income as no value', () => {
    // act
    render(
      { current: [bucket('2026-01-01', null), bucket('2026-02-01', 20)], comparison: [] },
      'SAVINGS_RATE',
    );

    // assert & verify
    expect(bars()[0].getAttribute('aria-label')).toBe('Jan 2026: no data');
  });

  // PF-888: up to a year of daily bars must not be a year of tab stops
  describe('keyboard', () => {
    const press = (key: string, from: HTMLElement): void => {
      from.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };

    it('should make the bars one tab stop', () => {
      // act
      render(MONTHS);

      // assert & verify
      expect(bars().map((b) => b.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    });

    it('should move focus and the tab stop with the arrow keys, Home and End', () => {
      // arrange
      render(MONTHS);
      bars()[0].focus();

      // act & assert
      press('ArrowRight', bars()[0]);
      expect(document.activeElement).toBe(bars()[1]);
      expect(bars().map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);

      press('End', bars()[1]);
      expect(document.activeElement).toBe(bars()[2]);

      press('ArrowRight', bars()[2]);
      expect(document.activeElement).toBe(bars()[2]); // stops at the end

      press('ArrowLeft', bars()[2]);
      expect(document.activeElement).toBe(bars()[1]);

      press('Home', bars()[1]);
      expect(document.activeElement).toBe(bars()[0]);
    });

    it('should keep a valid tab stop when the buckets change', () => {
      // arrange
      render(MONTHS);
      bars()[0].focus();
      press('End', bars()[0]);

      // act -- fewer buckets than the remembered stop
      render({ current: [bucket('2026-01-01', 100)], comparison: [] });

      // assert & verify
      expect(bars().map((b) => b.getAttribute('tabindex'))).toEqual(['0']);
    });

    it('should still select a bucket on click', () => {
      // arrange
      render(MONTHS);
      const picked: TrendBucket[] = [];
      fixture.componentInstance.selectBucket.subscribe((b: TrendBucket) => picked.push(b));

      // act
      bars()[1].click();

      // assert & verify
      expect(picked.map((b) => b.start)).toEqual(['2026-02-01']);
    });
  });

  it('should draw negative values below a zero line, not upward', () => {
    // arrange
    const trend: ExploreTrend = {
      current: [bucket('2026-01-01', 50), bucket('2026-02-01', -50)],
      comparison: [],
    };

    // act
    render(trend, 'SAVINGS_RATE');

    // assert & verify
    const [up, down] = fills();
    expect(up.style.bottom).toBe('50%');
    expect(down.style.bottom).toBe('0%');
    expect(down.style.height).toBe('50%');
    expect(fixture.nativeElement.querySelector('[data-testid="zero-line"]')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-testid="chart-legend"]').textContent,
    ).toContain('below the dashed line are negative');
  });

  it('should mark a bucket with no figure as no data, not as zero', () => {
    // act
    render({ current: [bucket('2026-01-01', 40), bucket('2026-02-01', null)], comparison: [] });

    // assert & verify
    expect(fixture.nativeElement.querySelectorAll('[data-no-data]')).toHaveLength(1);
    expect(fills()).toHaveLength(1);
  });

  it('should label the bars with month ticks and a year under the first', () => {
    // act
    render(MONTHS);

    // assert & verify
    const text: string = (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Jan 2026 Feb Mar');
  });

  it('should show the focused bar value and what the comparison bar stands for', () => {
    // arrange
    render(MONTHS);

    // act
    bars()[1].dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    // assert & verify
    const readout: string = fixture.nativeElement.querySelector(
      '[data-testid="chart-readout"]',
    ).textContent;
    expect(readout).toContain('Feb 2026: $50.00');
    expect(readout).toContain('Feb 2025: $60.00');
  });

  it('should make the hit area the whole column, even for a zero bar', () => {
    // act
    render({ current: [bucket('2026-01-01', 0), bucket('2026-02-01', 10)], comparison: [] });

    // assert & verify
    expect(bars()[0].className).toContain('inset-0');
  });
});
