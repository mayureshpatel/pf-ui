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

  const kroger1: Merchant = {
    id: 1,
    userId: 1,
    originalName: 'KROGER #431 ROSWELL',
    cleanName: 'Kroger',
  };
  const kroger2: Merchant = {
    id: 2,
    userId: 1,
    originalName: 'KROGER #999 ROSWELL',
    cleanName: 'Kroger',
  };
  const wholeFoods: Merchant = {
    id: 3,
    userId: 1,
    originalName: 'WHOLEFDS 5678',
    cleanName: 'Whole Foods',
  };

  const cleanNames: string[] = ['Kroger', 'Whole Foods'];

  const pageOf = (
    content: string[],
    totalElements: number = content.length,
  ): PageResponse<string> => ({
    content,
    page: {
      totalElements,
      totalPages: Math.max(1, Math.ceil(totalElements / 20)),
      number: 0,
      size: 20,
    },
  });

  // p-tabs' TabList calls ngAfterViewInit -> bindResizeObserver(), which JSDOM doesn't implement.
  beforeAll(() => {
    (globalThis as any).ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  });

  beforeEach(async () => {
    mockMerchantApi = {
      getDistinctCleanNames: vi.fn().mockReturnValue(of(pageOf(cleanNames))),
      getMerchantsByCleanName: vi.fn().mockReturnValue(of([kroger1, kroger2])),
      updateMerchant: vi.fn(),
      mergeMerchants: vi.fn(),
      getMerchantsNeedingReview: vi.fn().mockReturnValue(of([])),
      updateMerchantsBulk: vi.fn(),
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

  it('should create and load the first page of distinct clean names on init', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(component).toBeTruthy();
    expect(mockMerchantApi.getDistinctCleanNames).toHaveBeenCalledWith(null, { page: 0, size: 20 });
    expect(component.groups()).toEqual([
      { cleanName: 'Kroger', members: null },
      { cleanName: 'Whole Foods', members: null },
    ]);
    expect(component.totalRecords()).toBe(2);
  });

  it('should show an error toast when loading fails', () => {
    // arrange
    mockMerchantApi.getDistinctCleanNames.mockReturnValue(
      throwError(() => new Error('network error')),
    );

    // act
    fixture.detectChanges();

    // assert & verify
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load merchants');
    expect(component.loading()).toBe(false);
  });

  it('should treat an empty group list, once loaded, as isEmpty', () => {
    // arrange
    mockMerchantApi.getDistinctCleanNames.mockReturnValue(of(pageOf([], 0)));

    // act
    fixture.detectChanges();

    // assert & verify
    expect(component.isEmpty()).toBe(true);
  });

  describe('search (PF-320-style: server-side, debounced 300ms)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      fixture.detectChanges();
      mockMerchantApi.getDistinctCleanNames.mockClear();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not call the API immediately on each keystroke', () => {
      // act
      component.onSearchInput('kro');
      fixture.detectChanges();

      // assert & verify
      expect(mockMerchantApi.getDistinctCleanNames).not.toHaveBeenCalled();
    });

    it('should call the API with the search term once the debounce window elapses', () => {
      // act
      component.onSearchInput('kro');
      fixture.detectChanges();
      vi.advanceTimersByTime(300);
      fixture.detectChanges();

      // assert & verify
      expect(mockMerchantApi.getDistinctCleanNames).toHaveBeenCalledWith('kro', {
        page: 0,
        size: 20,
      });
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
      mockMerchantApi.getDistinctCleanNames.mockReturnValue(of(pageOf([], 0)));

      // act
      component.onSearchInput('nonexistent merchant');
      fixture.detectChanges();
      vi.advanceTimersByTime(300);
      fixture.detectChanges();

      // assert & verify
      expect(component.groups()).toEqual([]);
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
      expect(mockMerchantApi.getDistinctCleanNames).toHaveBeenCalledWith(null, {
        page: 2,
        size: 20,
      });
    });

    it('should collapse every expanded group when the page changes', () => {
      // arrange
      component.expandedRowKeys.set({ Kroger: true });

      // act
      component.onPageChange({ first: 20 });

      // assert & verify
      expect(component.expandedRowKeys()).toEqual({});
    });
  });

  describe('group expansion (PF-842: lazy-loaded members)', () => {
    beforeEach(() => fixture.detectChanges());

    it("should fetch a group's members the first time it's expanded", () => {
      // act
      component.onGroupExpand({ data: { cleanName: 'Kroger', members: null } });

      // assert & verify
      expect(mockMerchantApi.getMerchantsByCleanName).toHaveBeenCalledWith('Kroger');
      expect(component.groups().find((g) => g.cleanName === 'Kroger')?.members).toEqual([
        kroger1,
        kroger2,
      ]);
    });

    it('should NOT refetch an already-loaded group on a subsequent expand', () => {
      // arrange
      component.onGroupExpand({ data: { cleanName: 'Kroger', members: null } });
      mockMerchantApi.getMerchantsByCleanName.mockClear();

      // act -- re-expanding with the now-loaded group object
      const loadedGroup = component.groups().find((g) => g.cleanName === 'Kroger')!;
      component.onGroupExpand({ data: loadedGroup });

      // assert & verify
      expect(mockMerchantApi.getMerchantsByCleanName).not.toHaveBeenCalled();
    });

    it('should leave other groups untouched when one group is expanded', () => {
      // act
      component.onGroupExpand({ data: { cleanName: 'Kroger', members: null } });

      // assert & verify
      expect(component.groups().find((g) => g.cleanName === 'Whole Foods')?.members).toBeNull();
    });
  });

  it('should open the edit dialog with the selected merchant', () => {
    // arrange
    fixture.detectChanges();

    // act
    component.openEditDialog(kroger1);

    // assert & verify
    expect(component.selectedMerchant()).toEqual(kroger1);
    expect(component.showDialog()).toBe(true);
  });

  it('should reload the group list when onSave is called', () => {
    // arrange
    fixture.detectChanges();
    mockMerchantApi.getDistinctCleanNames.mockClear();

    // act
    component.onSave();

    // assert & verify
    expect(mockMerchantApi.getDistinctCleanNames).toHaveBeenCalledTimes(1);
  });

  it('should reload the group list when a Needs Review cluster is confirmed', () => {
    // arrange
    fixture.detectChanges();
    mockMerchantApi.getDistinctCleanNames.mockClear();

    // act
    component.onClusterConfirmed();

    // assert & verify
    expect(mockMerchantApi.getDistinctCleanNames).toHaveBeenCalledTimes(1);
  });

  describe('merge selection (PF-222), across independently-expanded groups', () => {
    beforeEach(() => fixture.detectChanges());

    it('should select a merchant not yet selected', () => {
      // act
      component.toggleForMerge(kroger1);

      // assert & verify
      expect(component.selectedForMerge()).toEqual([kroger1]);
      expect(component.isSelectedForMerge(kroger1)).toBe(true);
    });

    it('should deselect an already-selected merchant', () => {
      // arrange
      component.toggleForMerge(kroger1);

      // act
      component.toggleForMerge(kroger1);

      // assert & verify
      expect(component.selectedForMerge()).toEqual([]);
      expect(component.isSelectedForMerge(kroger1)).toBe(false);
    });

    it('should cap at 2, keeping the most recently selected pair, when a 3rd is checked', () => {
      // act -- 3 different merchants, from potentially different (independently expanded) groups
      component.toggleForMerge(kroger1);
      component.toggleForMerge(kroger2);
      component.toggleForMerge(wholeFoods);

      // assert & verify
      expect(component.selectedForMerge()).toEqual([kroger2, wholeFoods]);
    });

    it('should open the merge dialog', () => {
      // act
      component.openMergeDialog();

      // assert & verify
      expect(component.showMergeDialog()).toBe(true);
    });

    it('should clear the selection and reload the group list once a merge completes', () => {
      // arrange
      component.toggleForMerge(kroger1);
      component.toggleForMerge(kroger2);
      mockMerchantApi.getDistinctCleanNames.mockClear();

      // act
      component.onMerged();

      // assert & verify
      expect(component.selectedForMerge()).toEqual([]);
      expect(mockMerchantApi.getDistinctCleanNames).toHaveBeenCalledTimes(1);
    });
  });
});
