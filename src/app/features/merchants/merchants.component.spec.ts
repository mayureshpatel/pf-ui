import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { MerchantsComponent } from './merchants.component';
import { MerchantApiService } from './services/merchant-api.service';
import { ToastService } from '@core/services/toast.service';
import { Merchant } from '@models/merchant.model';
import { PageResponse } from '@models/transaction.model';

describe('MerchantsComponent', () => {
  let component: MerchantsComponent;
  let fixture: ComponentFixture<MerchantsComponent>;
  let mockMerchantApi: any;
  let mockToast: any;

  const mockMerchants: Merchant[] = [
    { id: 1, userId: 1, originalName: 'STARBUCKS #1234', cleanName: 'Starbucks' },
    { id: 2, userId: 1, originalName: 'WHOLEFDS 5678', cleanName: 'Whole Foods' },
    { id: 3, userId: 1, originalName: 'CHEVRON 00123 WA', cleanName: 'Chevron' },
  ];

  const pageOf = (content: Merchant[], totalElements: number = content.length): PageResponse<Merchant> => ({
    content,
    page: { totalElements, totalPages: Math.max(1, Math.ceil(totalElements / 20)), number: 0, size: 20 },
  });

  beforeEach(async () => {
    mockMerchantApi = {
      getMerchants: vi.fn().mockReturnValue(of(pageOf(mockMerchants))),
      updateMerchant: vi.fn(),
    };
    mockToast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MerchantsComponent, NoopAnimationsModule],
      providers: [
        { provide: MerchantApiService, useValue: mockMerchantApi },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MerchantsComponent);
    component = fixture.componentInstance;
  });

  it('should create and load the first page of merchants on init', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(component).toBeTruthy();
    expect(mockMerchantApi.getMerchants).toHaveBeenCalledWith(null, { page: 0, size: 20 });
    expect(component.merchants()).toEqual(mockMerchants);
    expect(component.totalRecords()).toBe(3);
  });

  it('should show an error toast when loading fails', () => {
    // arrange
    mockMerchantApi.getMerchants.mockReturnValue(throwError(() => new Error('network error')));

    // act
    fixture.detectChanges();

    // assert & verify
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load merchants');
    expect(component.loading()).toBe(false);
  });

  it('should treat an empty merchant list, once loaded, as isEmpty', () => {
    // arrange
    mockMerchantApi.getMerchants.mockReturnValue(of(pageOf([], 0)));

    // act
    fixture.detectChanges();

    // assert & verify
    expect(component.isEmpty()).toBe(true);
  });

  describe('search (PF-320: server-side, debounced 300ms)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      fixture.detectChanges();
      mockMerchantApi.getMerchants.mockClear();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not call the API immediately on each keystroke', () => {
      // act
      component.onSearchInput('starbu');
      fixture.detectChanges();

      // assert & verify
      expect(mockMerchantApi.getMerchants).not.toHaveBeenCalled();
    });

    it('should call the API with the search term once the debounce window elapses', () => {
      // act
      component.onSearchInput('starbu');
      fixture.detectChanges();
      vi.advanceTimersByTime(300);
      fixture.detectChanges();

      // assert & verify
      expect(mockMerchantApi.getMerchants).toHaveBeenCalledWith('starbu', { page: 0, size: 20 });
    });

    it('should reset to page 0 when the search term changes', () => {
      // arrange
      component.page.set(2);

      // act
      component.onSearchInput('starbu');
      fixture.detectChanges();
      vi.advanceTimersByTime(300);
      fixture.detectChanges();

      // assert & verify
      expect(component.page()).toBe(0);
    });

    it('should report noSearchResults when a search matches nothing, distinct from isEmpty', () => {
      // arrange
      mockMerchantApi.getMerchants.mockReturnValue(of(pageOf([], 0)));

      // act
      component.onSearchInput('nonexistent merchant');
      fixture.detectChanges();
      vi.advanceTimersByTime(300);
      fixture.detectChanges();

      // assert & verify
      expect(component.merchants()).toEqual([]);
      expect(component.noSearchResults()).toBe(true);
      expect(component.isEmpty()).toBe(false);
    });
  });

  describe('pagination (PF-320)', () => {
    beforeEach(() => fixture.detectChanges());

    it('should request the corresponding page when the table lazy-loads a new offset', () => {
      // act
      component.onPageChange({ first: 40 });

      // assert & verify
      expect(component.page()).toBe(2);
      expect(mockMerchantApi.getMerchants).toHaveBeenCalledWith(null, { page: 2, size: 20 });
    });
  });

  it('should open the edit dialog with the selected merchant', () => {
    // arrange
    fixture.detectChanges();

    // act
    component.openEditDialog(mockMerchants[1]);

    // assert & verify
    expect(component.selectedMerchant()).toEqual(mockMerchants[1]);
    expect(component.showDialog()).toBe(true);
  });

  it('should reload merchants when onSave is called', () => {
    // arrange
    fixture.detectChanges();
    mockMerchantApi.getMerchants.mockClear();

    // act
    component.onSave();

    // assert & verify
    expect(mockMerchantApi.getMerchants).toHaveBeenCalledTimes(1);
  });

  describe('merge selection (PF-222)', () => {
    beforeEach(() => fixture.detectChanges());

    it('should track up to 2 selected merchants', () => {
      // act
      component.onSelectionChange([mockMerchants[0], mockMerchants[1]]);

      // assert & verify
      expect(component.selectedForMerge()).toEqual([mockMerchants[0], mockMerchants[1]]);
    });

    it('should cap at 2, keeping the most recently selected pair, when a 3rd is checked', () => {
      // act -- table selection arrays reflect the full current selection, oldest first
      component.onSelectionChange([mockMerchants[0], mockMerchants[1], mockMerchants[2]]);

      // assert & verify
      expect(component.selectedForMerge()).toEqual([mockMerchants[1], mockMerchants[2]]);
    });

    it('should open the merge dialog', () => {
      // act
      component.openMergeDialog();

      // assert & verify
      expect(component.showMergeDialog()).toBe(true);
    });

    it('should clear the selection and reload merchants once a merge completes', () => {
      // arrange
      component.onSelectionChange([mockMerchants[0], mockMerchants[1]]);
      mockMerchantApi.getMerchants.mockClear();

      // act
      component.onMerged();

      // assert & verify
      expect(component.selectedForMerge()).toEqual([]);
      expect(mockMerchantApi.getMerchants).toHaveBeenCalledTimes(1);
    });
  });

  describe('rendering: display-name fallback (PF-223)', () => {
    it("falls back through cleanName -> originalName -> 'Unknown Merchant' in the table row, not just blank text", () => {
      // arrange -- a blank cleanName is a real-world "unset" sentinel (not null), independent of
      // MerchantNameNormalizer's own cleanup logic ever failing to backfill one
      mockMerchantApi.getMerchants.mockReturnValue(
        of(pageOf([{ id: 9, userId: 1, originalName: 'RAW BANK TEXT 123', cleanName: '' }])),
      );

      // act
      fixture.detectChanges();

      // assert & verify -- scoped to the Display Name column's own span: the adjacent Original
      // Bank Description column renders originalName unconditionally regardless of this fix, so
      // a whole-fixture textContent check would pass even without the fallback in place
      const displayNameCell = fixture.nativeElement.querySelector(
        'span.font-semibold.text-surface-900',
      );
      expect(displayNameCell.textContent.trim()).toBe('RAW BANK TEXT 123');
    });

    it("falls back all the way to 'Unknown Merchant' when both cleanName and originalName are blank", () => {
      // arrange
      mockMerchantApi.getMerchants.mockReturnValue(
        of(pageOf([{ id: 9, userId: 1, originalName: '', cleanName: '' }])),
      );

      // act
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('Unknown Merchant');
    });
  });
});
