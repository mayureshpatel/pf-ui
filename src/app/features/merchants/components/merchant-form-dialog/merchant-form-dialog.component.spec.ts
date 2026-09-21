import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { MerchantFormDialogComponent } from './merchant-form-dialog.component';
import { MerchantApiService } from '../../services/merchant-api.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/auth/auth.service';
import { Merchant } from '@models/merchant.model';
import { User } from '@models/auth.model';

describe('MerchantFormDialogComponent', () => {
  let component: MerchantFormDialogComponent;
  let fixture: ComponentFixture<MerchantFormDialogComponent>;
  let mockMerchantApi: any;
  let mockToast: any;
  let mockAuth: any;

  const mockMerchant: Merchant = {
    id: 7,
    userId: 1,
    name: 'Starbucks',
    city: 'Atlanta',
    state: 'GA',
    postalCode: '30301',
    country: 'USA',
  };
  const mockUser: User = { id: 1, username: 'jdoe', email: 'jdoe@test.com' };

  beforeEach(async () => {
    mockMerchantApi = {
      createMerchant: vi.fn().mockReturnValue(of(42)),
      updateMerchant: vi.fn().mockReturnValue(of(1)),
    };
    mockToast = { success: vi.fn(), error: vi.fn() };
    mockAuth = { user: signal<User | null>(mockUser) };

    await TestBed.configureTestingModule({
      imports: [MerchantFormDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MerchantApiService, useValue: mockMerchantApi },
        { provide: ToastService, useValue: mockToast },
        { provide: AuthService, useValue: mockAuth },
      ],
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

  describe('edit mode', () => {
    it('should pre-fill the form with the merchant when the dialog opens', () => {
      // act
      component.visible.set(true);
      fixture.detectChanges();

      // assert & verify
      expect(component.form.getRawValue()).toEqual({
        name: 'Starbucks',
        city: 'Atlanta',
        state: 'GA',
        postalCode: '30301',
        country: 'USA',
      });
      expect(component.isCreateMode()).toBe(false);
      expect(component.dialogHeader()).toBe('Edit Merchant');
    });

    it('should call updateMerchant with the full field set and the merchant id on submit', () => {
      // arrange
      component.visible.set(true);
      fixture.detectChanges();
      component.form.controls.name.setValue('Starbucks Coffee');

      // act
      component.onSubmit();

      // assert & verify
      expect(mockMerchantApi.updateMerchant).toHaveBeenCalledWith({
        id: 7,
        userId: 1,
        name: 'Starbucks Coffee',
        city: 'Atlanta',
        state: 'GA',
        postalCode: '30301',
        country: 'USA',
      });
    });

    it('should toast "Merchant updated" on success', () => {
      // arrange
      component.visible.set(true);
      fixture.detectChanges();

      // act
      component.onSubmit();

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('Merchant updated');
    });

    it("should emit the target merchant id, not updateMerchant's rows-affected return value", () => {
      // arrange -- updateMerchant resolves 1 (rows affected), which must not be mistaken for an id
      component.visible.set(true);
      fixture.detectChanges();
      const saveSpy = vi.fn();
      component.save.subscribe(saveSpy);

      // act
      component.onSubmit();

      // assert & verify
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 7, name: 'Starbucks' }));
    });

    it('should ignore initialName when editing an existing merchant', () => {
      // arrange
      fixture.componentRef.setInput('initialName', 'Some Other Name');

      // act
      component.visible.set(true);
      fixture.detectChanges();

      // assert & verify
      expect(component.form.controls.name.value).toBe('Starbucks');
    });
  });

  describe('create mode (merchant input is null)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('merchant', null);
    });

    it('should leave the form blank when the dialog opens', () => {
      // act
      component.visible.set(true);
      fixture.detectChanges();

      // assert & verify
      expect(component.form.getRawValue()).toEqual({
        name: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      });
      expect(component.isCreateMode()).toBe(true);
      expect(component.dialogHeader()).toBe('Add Merchant');
    });

    it('should call createMerchant with only the populated fields on submit', () => {
      // arrange
      component.visible.set(true);
      fixture.detectChanges();
      component.form.controls.name.setValue("Trader Joe's");

      // act
      component.onSubmit();

      // assert & verify -- blank optional fields become undefined, not sent as ''
      expect(mockMerchantApi.createMerchant).toHaveBeenCalledWith({
        userId: 1,
        name: "Trader Joe's",
        city: undefined,
        state: undefined,
        postalCode: undefined,
        country: undefined,
      });
    });

    it('should toast "Merchant created" on success', () => {
      // arrange
      component.visible.set(true);
      fixture.detectChanges();
      component.form.controls.name.setValue("Trader Joe's");

      // act
      component.onSubmit();

      // assert & verify
      expect(mockToast.success).toHaveBeenCalledWith('Merchant created');
    });

    it('should include a populated optional field, trimmed', () => {
      // arrange
      component.visible.set(true);
      fixture.detectChanges();
      component.form.controls.name.setValue("Trader Joe's");
      component.form.controls.city.setValue('  Atlanta  ');

      // act
      component.onSubmit();

      // assert & verify
      expect(mockMerchantApi.createMerchant).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Atlanta' }),
      );
    });

    it("should emit the id returned by createMerchant, not the target's (there is none)", () => {
      // arrange
      component.visible.set(true);
      fixture.detectChanges();
      component.form.controls.name.setValue("Trader Joe's");
      const saveSpy = vi.fn();
      component.save.subscribe(saveSpy);

      // act
      component.onSubmit();

      // assert & verify -- createMerchant resolves 42 in this spec's mock
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 42, userId: 1, name: "Trader Joe's" }),
      );
    });

    it('should pre-fill the name field from initialName when the dialog opens', () => {
      // arrange
      fixture.componentRef.setInput('initialName', 'Costco');

      // act
      component.visible.set(true);
      fixture.detectChanges();

      // assert & verify
      expect(component.form.controls.name.value).toBe('Costco');
    });

    it('should leave the name field blank when initialName is not provided', () => {
      // act
      component.visible.set(true);
      fixture.detectChanges();

      // assert & verify
      expect(component.form.controls.name.value).toBe('');
    });
  });

  it('should mark the form invalid when name is blank', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();

    // act
    component.form.controls.name.setValue('');

    // assert & verify
    expect(component.form.invalid).toBe(true);
  });

  it('should emit the saved merchant and close the dialog once the save succeeds', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();
    const saveSpy = vi.fn();
    component.save.subscribe(saveSpy);

    // act
    component.onSubmit();

    // assert & verify
    expect(saveSpy).toHaveBeenCalledWith({
      id: 7,
      userId: 1,
      name: 'Starbucks',
      city: 'Atlanta',
      state: 'GA',
      postalCode: '30301',
      country: 'USA',
    });
    expect(component.visible()).toBe(false);
  });

  it('should show an error message and keep the dialog open when the save fails', () => {
    // arrange
    mockMerchantApi.updateMerchant.mockReturnValue(
      throwError(() => ({ error: { detail: 'Merchant not found.' } })),
    );
    component.visible.set(true);
    fixture.detectChanges();

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
    component.form.controls.name.setValue('');

    // act
    component.onSubmit();

    // assert & verify
    expect(mockMerchantApi.updateMerchant).not.toHaveBeenCalled();
    expect(mockMerchantApi.createMerchant).not.toHaveBeenCalled();
  });
});
