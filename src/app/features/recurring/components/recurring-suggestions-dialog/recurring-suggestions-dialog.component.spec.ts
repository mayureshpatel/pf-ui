import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of} from 'rxjs';

import {RecurringSuggestionsDialogComponent} from './recurring-suggestions-dialog.component';
import {RecurringApiService} from '../../services/recurring-api.service';
import {ToastService} from '@core/services/toast.service';
import {RecurringSuggestion} from '@models/recurring.model';

describe('RecurringSuggestionsDialogComponent', () => {
  let component: RecurringSuggestionsDialogComponent;
  let fixture: ComponentFixture<RecurringSuggestionsDialogComponent>;
  let mockRecurringApi: any;
  let mockToast: any;

  const mockSuggestion: RecurringSuggestion = {
    merchant: {cleanName: 'Netflix'},
    amount: 15.99,
    frequency: 'MONTHLY',
    lastDate: '2026-01-01',
    nextDate: '2026-02-01',
    occurrenceCount: 3,
    confidenceScore: 92
  } as unknown as RecurringSuggestion;

  beforeEach(async () => {
    mockRecurringApi = {getSuggestions: vi.fn().mockReturnValue(of([mockSuggestion]))};
    mockToast = {error: vi.fn()};

    await TestBed.configureTestingModule({
      imports: [RecurringSuggestionsDialogComponent, NoopAnimationsModule],
      providers: [
        {provide: RecurringApiService, useValue: mockRecurringApi},
        {provide: ToastService, useValue: mockToast}
      ]
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
});
