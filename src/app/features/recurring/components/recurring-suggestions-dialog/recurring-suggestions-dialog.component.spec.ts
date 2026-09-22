import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { RecurringSuggestionsDialogComponent } from './recurring-suggestions-dialog.component';
import { RecurringApiService } from '../../services/recurring-api.service';
import { ToastService } from '@core/services/toast.service';
import { RecurringSuggestion } from '@models/recurring.model';

describe('RecurringSuggestionsDialogComponent', () => {
  let component: RecurringSuggestionsDialogComponent;
  let fixture: ComponentFixture<RecurringSuggestionsDialogComponent>;
  let mockRecurringApi: any;
  let mockToast: any;

  const mockSuggestion: RecurringSuggestion = {
    merchant: { name: 'Netflix' },
    amount: 15.99,
    frequency: 'MONTHLY',
    lastDate: '2026-01-01',
    nextDate: '2026-02-01',
    occurrenceCount: 3,
    confidenceScore: 92,
  } as unknown as RecurringSuggestion;

  beforeEach(async () => {
    mockRecurringApi = { getSuggestions: vi.fn().mockReturnValue(of([mockSuggestion])) };
    mockToast = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RecurringSuggestionsDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: RecurringApiService, useValue: mockRecurringApi },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecurringSuggestionsDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should give the Accept button an accessible name (PF-186)', () => {
    // already has a visible "Accept" label, but the tooltip text is a clearer accessible name
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-plus)');
    expect(button.getAttribute('aria-label')).toBe('Create recurring entry from this pattern');
  });

  describe('confidence display and color tiers (PF-835)', () => {
    // PF-835: the backend used to emit an uncapped ~0.8-1.5 raw score rendered with a literal "%"
    // -- the strongest real suggestion in the seeded dataset displayed as "1.35%", and the
    // emerald/amber thresholds below (which assume a real 0-100 scale) never differentiated
    // anything. Backend now emits a real 0-100 percentage (RecurringTransactionService PF-835 fix);
    // these tests pin the frontend's display + color-tier behavior against known scores so a future
    // regression on either side (backend scale drifting again, or these thresholds changing) is
    // caught here rather than only visually.

    it('renders the confidence score as a plain percentage of a known value', () => {
      // mockSuggestion (set in the outer beforeEach) uses confidenceScore: 92
      const confidenceCell: HTMLElement = fixture.nativeElement.querySelector('td:nth-child(4)');
      expect(confidenceCell.textContent).toContain('92%');
    });

    it('applies the emerald (high-confidence) tier at and above 90', () => {
      expect(component.getConfidenceStyle(90)).toContain('emerald');
      expect(component.getConfidenceStyle(100)).toContain('emerald');
    });

    it('applies the amber (mid-confidence) tier from 70 up to (not including) 90', () => {
      expect(component.getConfidenceStyle(70)).toContain('amber');
      expect(component.getConfidenceStyle(89)).toContain('amber');
    });

    it('falls through to the neutral tier below 70, never emerald or amber', () => {
      const style: string = component.getConfidenceStyle(69);
      expect(style).not.toContain('emerald');
      expect(style).not.toContain('amber');
    });
  });
});
