import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NetWorthMoved } from '../../models/reports.model';
import { NetWorthMovedComponent } from './net-worth-moved.component';

describe('NetWorthMovedComponent (PF-887)', () => {
  let fixture: ComponentFixture<NetWorthMovedComponent>;

  function render(moved: NetWorthMoved, compareLabel: string | null = 'a year ago'): void {
    fixture.componentRef.setInput('moved', moved);
    fixture.componentRef.setInput('compareLabel', compareLabel);
    fixture.detectChanges();
  }
  const rows = (): string[] =>
    Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('[data-testid="moved-row"]'),
    ).map((r) => (r.textContent ?? '').replace(/\s+/g, ' ').trim());

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NetWorthMovedComponent] });
    fixture = TestBed.createComponent(NetWorthMovedComponent);
  });

  it('should show saved, the remainder and the total in the verbatim wording', () => {
    // act
    render({ change: 14120, saved: 9860, other: 4260 });

    // assert & verify
    expect(rows()).toEqual([
      'Saved: income minus spending +$9,860',
      'Investment growth and other adjustments +$4,260',
      'Total change +$14,120',
    ]);
    expect(fixture.nativeElement.textContent).toContain('What moved it (vs a year ago)');
  });

  it('should show a negative remainder with a minus sign and the word down', () => {
    // act
    render({ change: 100, saved: 420, other: -320 });

    // assert & verify
    const remainder = rows()[1];
    expect(remainder).toContain('-$320');
    expect(remainder).toContain('down');
  });

  it('should name the range when not comparing', () => {
    // act
    render({ change: 0, saved: 0, other: 0 }, null);

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('What moved it (over the range)');
  });

  it('should say the two parts add up to the total', () => {
    // act
    render({ change: 14120, saved: 9860, other: 4260 });

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('adds up to the total change');
  });
});
