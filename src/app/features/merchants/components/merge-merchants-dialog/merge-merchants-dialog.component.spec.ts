import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { MergeMerchantsDialogComponent } from './merge-merchants-dialog.component';
import { MerchantApiService } from '../../services/merchant-api.service';
import { ToastService } from '@core/services/toast.service';
import { Merchant } from '@models/merchant.model';

describe('MergeMerchantsDialogComponent', () => {
  let component: MergeMerchantsDialogComponent;
  let fixture: ComponentFixture<MergeMerchantsDialogComponent>;
  let mockMerchantApi: any;
  let mockToast: any;

  const merchantA: Merchant = {
    id: 1,
    userId: 1,
    originalName: 'STARBUCKS #100',
    cleanName: 'Starbucks',
  };
  const merchantB: Merchant = {
    id: 2,
    userId: 1,
    originalName: 'STARBUCKS #200',
    cleanName: 'Starbucks Coffee',
  };

  beforeEach(async () => {
    mockMerchantApi = { mergeMerchants: vi.fn().mockReturnValue(of(undefined)) };
    mockToast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MergeMerchantsDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MerchantApiService, useValue: mockMerchantApi },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MergeMerchantsDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('merchants', [merchantA, merchantB]);
    fixture.componentRef.setInput('visible', false);
  });

  it('should create', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(component).toBeTruthy();
  });

  it('should require an explicit choice: no survivor is pre-selected when the dialog opens', () => {
    // act
    component.visible.set(true);
    fixture.detectChanges();

    // assert & verify
    expect(component.survivingMerchantId()).toBeNull();
    expect(component.mergedAwayMerchant()).toBeNull();
  });

  it('should compute the merged-away merchant as whichever one was not chosen to survive', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();

    // act
    component.survivingMerchantId.set(merchantA.id);

    // assert & verify
    expect(component.mergedAwayMerchant()).toEqual(merchantB);
  });

  it('should not call the API when no survivor has been chosen', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();

    // act
    component.onSubmit();

    // assert & verify
    expect(mockMerchantApi.mergeMerchants).not.toHaveBeenCalled();
  });

  it('should call mergeMerchants with the chosen survivor and the other as merged-away', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();
    component.survivingMerchantId.set(merchantB.id);

    // act
    component.onSubmit();

    // assert & verify
    expect(mockMerchantApi.mergeMerchants).toHaveBeenCalledWith({
      survivingMerchantId: merchantB.id,
      mergedAwayMerchantId: merchantA.id,
    });
  });

  it('should emit merged, toast success, and close the dialog once the merge succeeds', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();
    component.survivingMerchantId.set(merchantA.id);
    const mergedSpy = vi.fn();
    component.merged.subscribe(mergedSpy);

    // act
    component.onSubmit();

    // assert & verify
    expect(mergedSpy).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith('Merchants merged');
    expect(component.visible()).toBe(false);
  });

  it('should show an error message and keep the dialog open when the merge fails', () => {
    // arrange
    mockMerchantApi.mergeMerchants.mockReturnValue(
      throwError(() => ({ error: { detail: 'Surviving merchant not found.' } })),
    );
    component.visible.set(true);
    fixture.detectChanges();
    component.survivingMerchantId.set(merchantA.id);

    // act
    component.onSubmit();

    // assert & verify
    expect(component.errorMessage()).toBe('Surviving merchant not found.');
    expect(component.visible()).toBe(true);
  });

  it('should reset the choice when reopened for a different pair', () => {
    // arrange -- open, choose, close
    component.visible.set(true);
    fixture.detectChanges();
    component.survivingMerchantId.set(merchantA.id);
    component.visible.set(false);
    fixture.detectChanges();

    // act -- reopen
    component.visible.set(true);
    fixture.detectChanges();

    // assert & verify
    expect(component.survivingMerchantId()).toBeNull();
  });

  describe('rendering: display-name fallback (PF-223)', () => {
    const blankCleanName: Merchant = {
      id: 3,
      userId: 1,
      originalName: 'RAW TEXT 999',
      cleanName: '',
    };

    it('falls back to originalName in the radio-choice label when cleanName is blank', () => {
      // arrange -- sole entry, so there is exactly one radio-choice label to inspect; the
      // secondary "original bank description" line renders originalName unconditionally
      // regardless of this fix, so asserting on the whole fixture's textContent would pass
      // even without the fallback -- must scope to the primary (font-semibold) span itself
      fixture.componentRef.setInput('merchants', [blankCleanName]);
      component.visible.set(true);

      // act
      fixture.detectChanges();

      // assert & verify
      const primaryLabel = fixture.nativeElement.querySelector(
        'span.font-semibold.text-surface-900',
      );
      expect(primaryLabel.textContent.trim()).toBe('RAW TEXT 999');
    });

    it("falls back to originalName in the 'will be deleted' warning when the merged-away merchant's cleanName is blank", () => {
      // arrange
      fixture.componentRef.setInput('merchants', [merchantA, blankCleanName]);
      component.visible.set(true);
      fixture.detectChanges();

      // act -- keep merchantA, so blankCleanName is the one merged away
      component.survivingMerchantId.set(merchantA.id);
      fixture.detectChanges();

      // assert & verify -- scope to the warning box itself (unique via bg-amber-50): the radio
      // list above it also renders blankCleanName's raw originalName unconditionally in its own
      // secondary line, which would make a whole-fixture textContent check pass regardless of
      // whether this box's own fallback actually works
      const warningBox = fixture.nativeElement.querySelector('.bg-amber-50');
      expect(warningBox.textContent).toContain('RAW TEXT 999');
      expect(warningBox.textContent).toContain('will be deleted');
    });
  });
});
