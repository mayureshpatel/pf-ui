import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionBulkBarComponent } from './transaction-bulk-bar.component';

describe('TransactionBulkBarComponent', () => {
  let fixture: ComponentFixture<TransactionBulkBarComponent>;

  function render(selectionCount: number, allTransfers = false, busy = false): void {
    fixture.componentRef.setInput('selectionCount', selectionCount);
    fixture.componentRef.setInput('allTransfers', allTransfers);
    fixture.componentRef.setInput('busy', busy);
    fixture.detectChanges();
  }

  const button = (name: RegExp): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      name.test(b.textContent ?? ''),
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionBulkBarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TransactionBulkBarComponent);
  });

  it('should render nothing when nothing is selected', () => {
    // act
    render(0);

    // assert & verify
    expect(fixture.nativeElement.querySelector('[role="region"]')).toBeNull();
  });

  it('should say how many are selected, with correct singular and plural', () => {
    // act
    render(1);
    // assert & verify
    expect(fixture.nativeElement.querySelector('[role="region"]').textContent).toContain(
      '1 selected',
    );

    // act
    render(23);
    // assert & verify
    expect(fixture.nativeElement.querySelector('[role="region"]').textContent).toContain(
      '23 selected',
    );
  });

  it('should emit each action', () => {
    // arrange
    render(2);
    const events = { set: vi.fn(), mark: vi.fn(), more: vi.fn(), clear: vi.fn() };
    const c = fixture.componentInstance;
    c.setCategory.subscribe(events.set);
    c.markTransfer.subscribe(events.mark);
    c.editMore.subscribe(events.more);
    c.clear.subscribe(events.clear);

    // act
    button(/Set category/)?.click();
    button(/Mark as transfer/)?.click();
    button(/Edit more/)?.click();
    button(/Clear/)?.click();

    // assert & verify
    expect(events.set).toHaveBeenCalledTimes(1);
    expect(events.mark).toHaveBeenCalledTimes(1);
    expect(events.more).toHaveBeenCalledTimes(1);
    expect(events.clear).toHaveBeenCalledTimes(1);
  });

  it('should offer Unmark as transfer instead of Mark when every selected row is a transfer', () => {
    // act
    render(2, true);

    // assert & verify
    expect(button(/Unmark as transfer/)).toBeTruthy();
    expect(button(/^\s*Mark as transfer/)).toBeUndefined();
  });

  it('should disable the actions while busy', () => {
    // act
    render(2, false, true);

    // assert & verify
    expect(button(/Set category/)?.disabled).toBe(true);
    expect(button(/Mark as transfer/)?.disabled).toBe(true);
  });

  it('should be fixed to the viewport, not sticky, so it floats even inside a clipping container', () => {
    // act
    render(2);

    // assert & verify -- the app's <main> has overflow set, which silently disables sticky
    const region: HTMLElement = fixture.nativeElement.querySelector('[role="region"]');
    expect(region.className).toContain('fixed');
    expect(region.className).not.toContain('sticky');
  });
});
