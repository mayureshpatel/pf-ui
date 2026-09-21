import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ConfirmationService } from 'primeng/api';
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
  let mockConfirmationService: any;

  const kroger: Merchant = {
    id: 1,
    userId: 1,
    name: 'Kroger',
    city: 'Roswell',
    state: 'GA',
    postalCode: null,
    country: null,
  };
  const wholeFoods: Merchant = {
    id: 2,
    userId: 1,
    name: 'Whole Foods',
    city: null,
    state: null,
    postalCode: null,
    country: null,
  };

  const pageOf = (
    content: Merchant[],
    totalElements: number = content.length,
  ): PageResponse<Merchant> => ({
    content,
    page: {
      totalElements,
      totalPages: Math.max(1, Math.ceil(totalElements / 20)),
      number: 0,
      size: 20,
    },
  });

  beforeEach(async () => {
    mockMerchantApi = {
      getMerchants: vi.fn().mockReturnValue(of(pageOf([kroger, wholeFoods]))),
      deleteMerchant: vi.fn().mockReturnValue(of(undefined)),
    };
    mockToast = { success: vi.fn(), error: vi.fn() };
    mockConfirmationService = { confirm: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MerchantsComponent, NoopAnimationsModule],
      providers: [
        { provide: MerchantApiService, useValue: mockMerchantApi },
        { provide: ToastService, useValue: mockToast },
        { provide: ConfirmationService, useValue: mockConfirmationService },
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
    expect(component.merchants()).toEqual([kroger, wholeFoods]);
    expect(component.totalRecords()).toBe(2);
  });

  it('should show an error toast and error state when loading fails', () => {
    // arrange
    mockMerchantApi.getMerchants.mockReturnValue(throwError(() => new Error('network error')));

    // act
    fixture.detectChanges();

    // assert & verify
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load merchants');
    expect(component.loading()).toBe(false);
    expect(component.loadError()).toBe(true);
  });

  it('should treat an empty merchant list, once loaded, as isEmpty', () => {
    // arrange
    mockMerchantApi.getMerchants.mockReturnValue(of(pageOf([], 0)));

    // act
    fixture.detectChanges();

    // assert & verify
    expect(component.isEmpty()).toBe(true);
  });

  describe('search (PF-320-style: server-side, debounced 300ms)', () => {
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
      component.onSearchInput('kro');
      fixture.detectChanges();

      // assert & verify
      expect(mockMerchantApi.getMerchants).not.toHaveBeenCalled();
    });

    it('should call the API with the search term once the debounce window elapses', () => {
      // act
      component.onSearchInput('kro');
      fixture.detectChanges();
      vi.advanceTimersByTime(300);
      fixture.detectChanges();

      // assert & verify
      expect(mockMerchantApi.getMerchants).toHaveBeenCalledWith('kro', { page: 0, size: 20 });
    });

    it('should reset to page 0 when the search term changes', () => {
      // arrange
      component.page.set(2);

      // act
      component.onSearchInput('kro');
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

  describe('pagination', () => {
    beforeEach(() => fixture.detectChanges());

    it('should request the corresponding page when the table lazy-loads a new offset', () => {
      // act
      component.onPageChange({ first: 40 });

      // assert & verify
      expect(component.page()).toBe(2);
      expect(mockMerchantApi.getMerchants).toHaveBeenCalledWith(null, { page: 2, size: 20 });
    });
  });

  describe('create/edit dialog', () => {
    beforeEach(() => fixture.detectChanges());

    it('should open the dialog in create mode with no target merchant', () => {
      // act
      component.openCreateDialog();

      // assert & verify
      expect(component.selectedMerchant()).toBeNull();
      expect(component.showDialog()).toBe(true);
    });

    it('should open the dialog in edit mode with the selected merchant', () => {
      // act
      component.openEditDialog(kroger);

      // assert & verify
      expect(component.selectedMerchant()).toEqual(kroger);
      expect(component.showDialog()).toBe(true);
    });

    it('should reload the list when onSave is called', () => {
      // arrange
      mockMerchantApi.getMerchants.mockClear();

      // act
      component.onSave();

      // assert & verify
      expect(mockMerchantApi.getMerchants).toHaveBeenCalledTimes(1);
    });
  });

  describe('linked-descriptions dialog', () => {
    beforeEach(() => fixture.detectChanges());

    it('should open the links dialog for the selected merchant', () => {
      // act
      component.openLinksDialog(kroger);

      // assert & verify
      expect(component.linksMerchant()).toEqual(kroger);
      expect(component.showLinksDialog()).toBe(true);
    });
  });

  describe('deleteMerchant', () => {
    beforeEach(() => fixture.detectChanges());

    it('should open confirmation and delete upon accept', () => {
      // arrange
      mockConfirmationService.confirm.mockImplementation((config: any) => {
        config.accept?.();
        return mockConfirmationService;
      });

      // act
      component.deleteMerchant(kroger);

      // assert & verify
      expect(mockConfirmationService.confirm).toHaveBeenCalled();
      expect(mockMerchantApi.deleteMerchant).toHaveBeenCalledWith(kroger.id);
      expect(mockToast.success).toHaveBeenCalledWith('Merchant deleted');
    });

    it('should not delete without confirmation', () => {
      // arrange -- confirm() never invokes accept
      mockConfirmationService.confirm.mockImplementation(() => mockConfirmationService);

      // act
      component.deleteMerchant(kroger);

      // assert & verify
      expect(mockMerchantApi.deleteMerchant).not.toHaveBeenCalled();
    });

    it('should toast an error and not throw when delete fails', () => {
      // arrange
      mockConfirmationService.confirm.mockImplementation((config: any) => {
        config.accept?.();
        return mockConfirmationService;
      });
      mockMerchantApi.deleteMerchant.mockReturnValue(
        throwError(() => ({ error: { detail: 'Cannot delete' } })),
      );

      // act
      component.deleteMerchant(kroger);

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Cannot delete');
    });
  });
});
