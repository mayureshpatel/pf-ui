import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {AccountFormDrawerComponent} from './account-form-drawer.component';
import {Account, AccountType, BankName} from '@models/account.model';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';

describe('AccountFormDrawerComponent', () => {
  let component: AccountFormDrawerComponent;
  let fixture: ComponentFixture<AccountFormDrawerComponent>;

  const mockAccountTypes: AccountType[] = [
    {
      code: 'CHECKING',
      label: 'Checking',
      isAsset: true,
      sortOrder: 1,
      isActive: true,
      icon: 'pi-money-bill',
      color: 'green'
    }
  ];

  const mockAccount = {
    id: 1,
    name: 'Existing Account',
    type: mockAccountTypes[0],
    currentBalance: 500,
    currency: {code: 'USD', name: 'US Dollar', symbol: '$', isActive: true},
    bank: BankName.STANDARD,
    version: 1,
    user: {id: 1}
  } as Account;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountFormDrawerComponent, NoopAnimationsModule]
    }).compileComponents();

    fixture = TestBed.createComponent(AccountFormDrawerComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('accountTypes', mockAccountTypes);
    fixture.componentRef.setInput('account', null);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('isEditMode & computed signals', () => {
    it('should be false and set create titles when account is null', () => {
      fixture.componentRef.setInput('account', null);
      fixture.detectChanges();

      expect(component.isEditMode()).toBe(false);
      expect(component.drawerTitle()).toBe('Create Account');
      expect(component.drawerIcon()).toBe('pi-plus');
    });

    it('should be true and set edit titles when account is provided', () => {
      fixture.componentRef.setInput('account', mockAccount);
      fixture.detectChanges();

      expect(component.isEditMode()).toBe(true);
      expect(component.drawerTitle()).toBe('Edit Account');
      expect(component.drawerIcon()).toBe('pi-wallet');
    });
  });

  describe('onShow', () => {
    it('should patch form for creation when account is null', () => {
      fixture.componentRef.setInput('account', null);

      // Modify form to ensure it gets reset
      component.form.controls.name.setValue('Dirty Name');
      component.errorMessage.set('Error');

      component.onShow();

      expect(component.errorMessage()).toBeNull();
      expect(component.form.controls.id.value).toBeNull();
      expect(component.form.controls.name.value).toBe('');
      expect(component.form.controls.type.value).toBeNull();
      expect(component.form.controls.currentBalance.value).toBe(0);
      expect(component.form.controls.bankName.value).toBeNull();
      expect(component.form.controls.currentBalance.enabled).toBe(true);
    });

    it('should patch form with account data when account is provided', () => {
      fixture.componentRef.setInput('account', mockAccount);

      component.onShow();

      expect(component.form.controls.id.value).toBe(mockAccount.id);
      expect(component.form.controls.name.value).toBe(mockAccount.name);
      expect(component.form.controls.type.value).toEqual(mockAccount.type);
      expect(component.form.controls.currencyCode.value).toBe(mockAccount.currency.code);
      expect(component.form.controls.currentBalance.value).toBe(mockAccount.currentBalance);
      expect(component.form.controls.bankName.value).toBe(mockAccount.bank);
      expect(component.form.controls.currentBalance.disabled).toBe(true);
    });
  });

  describe('onSubmit', () => {
    it('should not emit save event if form is invalid', () => {
      vi.spyOn(component.save, 'emit');
      vi.spyOn(component.form, 'markAllAsTouched');

      // Form is invalid by default (missing name, type)
      component.onSubmit();

      expect(component.form.markAllAsTouched).toHaveBeenCalled();
      expect(component.save.emit).not.toHaveBeenCalled();
    });

    it('should emit create request when account is null', () => {
      vi.spyOn(component.save, 'emit');
      fixture.componentRef.setInput('account', null);

      component.form.patchValue({
        name: 'New Account',
        type: mockAccountTypes[0],
        currencyCode: 'USD',
        currentBalance: 100,
        bankName: BankName.STANDARD
      });

      component.onSubmit();

      expect(component.save.emit).toHaveBeenCalledWith({
        name: 'New Account',
        type: 'CHECKING',
        startingBalance: 100,
        currencyCode: 'USD',
        bankName: 'STANDARD'
      });
    });

    it('should handle null bankName fallback to empty string on create', () => {
      vi.spyOn(component.save, 'emit');
      fixture.componentRef.setInput('account', null);

      component.form.patchValue({
        name: 'New Account',
        type: mockAccountTypes[0],
        currencyCode: 'USD',
        currentBalance: 100,
        bankName: null
      });

      component.onSubmit();

      expect(component.save.emit).toHaveBeenCalledWith(expect.objectContaining({
        bankName: ''
      }));
    });

    it('should emit update request when account is provided', () => {
      vi.spyOn(component.save, 'emit');
      fixture.componentRef.setInput('account', mockAccount);

      // onShow usually patches the form, we simulate this
      component.onShow();

      // User modifies name
      component.form.patchValue({
        name: 'Updated Name',
        bankName: BankName.CAPITAL_ONE
      });

      component.onSubmit();

      expect(component.save.emit).toHaveBeenCalledWith({
        id: mockAccount.id,
        name: 'Updated Name',
        type: 'CHECKING',
        currencyCode: 'USD',
        bankName: 'CAPITAL_ONE',
        version: mockAccount.version
      });
    });

    it('should handle null bankName fallback to empty string on update', () => {
      vi.spyOn(component.save, 'emit');
      fixture.componentRef.setInput('account', mockAccount);

      component.onShow();

      component.form.patchValue({
        bankName: null
      });

      component.onSubmit();

      expect(component.save.emit).toHaveBeenCalledWith(expect.objectContaining({
        bankName: ''
      }));
    });
  });

  describe('openReconcileDialog', () => {
    it('should set showReconcileDialog to true', () => {
      expect(component.showReconcileDialog()).toBe(false);
      component.openReconcileDialog();
      expect(component.showReconcileDialog()).toBe(true);
    });
  });
});
