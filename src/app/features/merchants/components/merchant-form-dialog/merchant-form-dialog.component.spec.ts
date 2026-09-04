import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of, throwError} from 'rxjs';

import {MerchantFormDialogComponent} from './merchant-form-dialog.component';
import {MerchantApiService} from '../../services/merchant-api.service';
import {ToastService} from '@core/services/toast.service';
import {Merchant} from '@models/merchant.model';

describe('MerchantFormDialogComponent', () => {
  let component: MerchantFormDialogComponent;
  let fixture: ComponentFixture<MerchantFormDialogComponent>;
  let mockMerchantApi: any;
  let mockToast: any;

  const mockMerchant: Merchant = {id: 7, userId: 1, originalName: 'STARBUCKS #100', cleanName: 'Starbucks'};

  beforeEach(async () => {
    mockMerchantApi = {updateMerchant: vi.fn().mockReturnValue(of(1))};
    mockToast = {success: vi.fn(), error: vi.fn()};

    await TestBed.configureTestingModule({
      imports: [MerchantFormDialogComponent, NoopAnimationsModule],
      providers: [
        {provide: MerchantApiService, useValue: mockMerchantApi},
        {provide: ToastService, useValue: mockToast}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MerchantFormDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('merchant', mockMerchant);
    fixture.componentRef.setInput('visible', false);
  });

  it('should create', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(component).toBeTruthy();
  });

  it('should pre-fill the form with the merchant clean name when the dialog opens', () => {
    // act
    component.visible.set(true);
    fixture.detectChanges();

    // assert & verify
    expect(component.form.controls.cleanName.value).toBe('Starbucks');
  });

  it('should mark cleanName invalid when blank', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();

    // act
    component.form.controls.cleanName.setValue('');

    // assert & verify
    expect(component.form.invalid).toBe(true);
  });

  it('should call updateMerchant with the merchant id and the corrected name on submit', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();
    component.form.controls.cleanName.setValue('Starbucks Coffee');

    // act
    component.onSubmit();

    // assert & verify
    expect(mockMerchantApi.updateMerchant).toHaveBeenCalledWith({id: 7, cleanName: 'Starbucks Coffee'});
  });

  it('should emit save, toast success, and close the dialog once the update succeeds', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();
    component.form.controls.cleanName.setValue('Starbucks Coffee');
    const saveSpy = vi.fn();
    component.save.subscribe(saveSpy);

    // act
    component.onSubmit();

    // assert & verify
    expect(saveSpy).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith('Merchant name updated');
    expect(component.visible()).toBe(false);
  });

  it('should show an error message and keep the dialog open when the update fails', () => {
    // arrange
    mockMerchantApi.updateMerchant.mockReturnValue(
      throwError(() => ({error: {detail: 'Merchant not found.'}}))
    );
    component.visible.set(true);
    fixture.detectChanges();
    component.form.controls.cleanName.setValue('Starbucks Coffee');

    // act
    component.onSubmit();

    // assert & verify
    expect(component.errorMessage()).toBe('Merchant not found.');
    expect(component.visible()).toBe(true);
  });

  it('should not call the API when the form is invalid', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();
    component.form.controls.cleanName.setValue('');

    // act
    component.onSubmit();

    // assert & verify
    expect(mockMerchantApi.updateMerchant).not.toHaveBeenCalled();
  });
});
