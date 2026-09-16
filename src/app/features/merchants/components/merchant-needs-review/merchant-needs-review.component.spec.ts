import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { MerchantNeedsReviewComponent } from './merchant-needs-review.component';
import { MerchantApiService } from '../../services/merchant-api.service';
import { ToastService } from '@core/services/toast.service';
import { Merchant, MerchantReviewCluster } from '@models/merchant.model';

describe('MerchantNeedsReviewComponent', () => {
  let component: MerchantNeedsReviewComponent;
  let fixture: ComponentFixture<MerchantNeedsReviewComponent>;
  let mockMerchantApi: any;
  let mockToast: any;

  const krogerA: Merchant = {
    id: 1,
    userId: 1,
    originalName: 'KROGER #431 ROSWELL GA',
    cleanName: '',
  };
  const krogerB: Merchant = {
    id: 2,
    userId: 1,
    originalName: 'KROGER #999 ROSWELL GA',
    cleanName: '',
  };
  const amazon: Merchant = { id: 3, userId: 1, originalName: 'AMAZON', cleanName: '' };

  const clusters: MerchantReviewCluster[] = [
    { suggestedCleanName: 'Kroger Roswell', merchants: [krogerA, krogerB] },
    { suggestedCleanName: 'Amazon', merchants: [amazon] },
  ];

  beforeEach(async () => {
    mockMerchantApi = {
      getMerchantsNeedingReview: vi.fn().mockReturnValue(of(clusters)),
      updateMerchantsBulk: vi.fn().mockReturnValue(of(2)),
    };
    mockToast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MerchantNeedsReviewComponent, NoopAnimationsModule],
      providers: [
        { provide: MerchantApiService, useValue: mockMerchantApi },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MerchantNeedsReviewComponent);
    component = fixture.componentInstance;
  });

  it('should load clusters on init, with nothing excluded yet', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(mockMerchantApi.getMerchantsNeedingReview).toHaveBeenCalled();
    expect(component.clusters()).toEqual([
      {
        suggestedCleanName: 'Kroger Roswell',
        merchants: [krogerA, krogerB],
        excludedIds: new Set(),
      },
      { suggestedCleanName: 'Amazon', merchants: [amazon], excludedIds: new Set() },
    ]);
  });

  it('should show an error toast and set loadError when loading fails', () => {
    // arrange
    mockMerchantApi.getMerchantsNeedingReview.mockReturnValue(
      throwError(() => new Error('network error')),
    );

    // act
    fixture.detectChanges();

    // assert & verify
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load merchants needing review');
    expect(component.loadError()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  describe('editing a cluster before confirming', () => {
    beforeEach(() => fixture.detectChanges());

    it("should update only the targeted cluster's suggested name", () => {
      // act
      component.updateSuggestedName(0, 'Kroger');

      // assert & verify
      expect(component.clusters()[0].suggestedCleanName).toBe('Kroger');
      expect(component.clusters()[1].suggestedCleanName).toBe('Amazon');
    });

    it('should exclude a member row, reducing includedCount by one', () => {
      // act
      component.toggleExcluded(0, krogerB.id);

      // assert & verify
      expect(component.isExcluded(component.clusters()[0], krogerB.id)).toBe(true);
      expect(component.includedCount(component.clusters()[0])).toBe(1);
    });

    it('should re-include a previously-excluded member row', () => {
      // arrange
      component.toggleExcluded(0, krogerB.id);

      // act
      component.toggleExcluded(0, krogerB.id);

      // assert & verify
      expect(component.isExcluded(component.clusters()[0], krogerB.id)).toBe(false);
      expect(component.includedCount(component.clusters()[0])).toBe(2);
    });

    it('should not affect other clusters when excluding a row in one cluster', () => {
      // act
      component.toggleExcluded(0, krogerA.id);

      // assert & verify
      expect(component.includedCount(component.clusters()[1])).toBe(1);
    });
  });

  describe('confirmCluster', () => {
    beforeEach(() => fixture.detectChanges());

    it('should bulk-update every non-excluded member to the (possibly edited) suggested name', () => {
      // arrange
      component.updateSuggestedName(0, 'Kroger');

      // act
      component.confirmCluster(0);

      // assert & verify
      expect(mockMerchantApi.updateMerchantsBulk).toHaveBeenCalledWith([
        { id: krogerA.id, cleanName: 'Kroger' },
        { id: krogerB.id, cleanName: 'Kroger' },
      ]);
    });

    it('should omit excluded members from the bulk request', () => {
      // arrange
      component.toggleExcluded(0, krogerB.id);

      // act
      component.confirmCluster(0);

      // assert & verify
      expect(mockMerchantApi.updateMerchantsBulk).toHaveBeenCalledWith([
        { id: krogerA.id, cleanName: 'Kroger Roswell' },
      ]);
    });

    it('should remove the cluster from view and emit confirmed on success', () => {
      // arrange
      const confirmedSpy = vi.fn();
      component.confirmed.subscribe(confirmedSpy);

      // act
      component.confirmCluster(0);

      // assert & verify
      expect(component.clusters()).toEqual([
        { suggestedCleanName: 'Amazon', merchants: [amazon], excludedIds: new Set() },
      ]);
      expect(confirmedSpy).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalled();
    });

    it('should leave the other cluster untouched when one is confirmed', () => {
      // act
      component.confirmCluster(0);

      // assert & verify
      expect(component.clusters()[0].suggestedCleanName).toBe('Amazon');
    });

    it('should do nothing when every member of the cluster is excluded', () => {
      // arrange
      component.toggleExcluded(0, krogerA.id);
      component.toggleExcluded(0, krogerB.id);

      // act
      component.confirmCluster(0);

      // assert & verify
      expect(mockMerchantApi.updateMerchantsBulk).not.toHaveBeenCalled();
      expect(component.clusters()).toHaveLength(2);
    });

    it('should do nothing when the suggested name is blank', () => {
      // arrange
      component.updateSuggestedName(0, '   ');

      // act
      component.confirmCluster(0);

      // assert & verify
      expect(mockMerchantApi.updateMerchantsBulk).not.toHaveBeenCalled();
    });

    it('should show an error toast, and leave the cluster in place, when the bulk update fails', () => {
      // arrange
      mockMerchantApi.updateMerchantsBulk.mockReturnValue(
        throwError(() => ({ error: { detail: 'Conflict' } })),
      );

      // act
      component.confirmCluster(0);

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Conflict');
      expect(component.clusters()).toHaveLength(2);
    });
  });
});
