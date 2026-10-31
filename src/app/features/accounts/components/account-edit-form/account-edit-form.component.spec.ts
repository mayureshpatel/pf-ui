import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountEditFormComponent } from './account-edit-form.component';
import { Account, AccountType, BankName } from '@models/account.model';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('AccountEditFormComponent', () => {
  let component: AccountEditFormComponent;
  let fixture: ComponentFixture<AccountEditFormComponent>;

  const mockAccountTypes: AccountType[] = [
    {
      code: 'CHECKING',
      label: 'Checking',
      isAsset: true,
      sortOrder: 1,
      isActive: true,
      icon: 'pi-money-bill',
      color: 'green',
    },
  ];

  const mockAccount = {
    id: 1,
    name: 'Existing Account',
    type: mockAccountTypes[0],
    currentBalance: 500,
    currency: { code: 'USD', name: 'US Dollar', symbol: '$', isActive: true },
    bank: BankName.STANDARD,
    version: 1,
    user: { id: 1 },
  } as Account;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountEditFormComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountEditFormComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('accountTypes', mockAccountTypes);
    fixture.componentRef.setInput('account', null);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('isEditMode', () => {
    it('should be false when account is null and true when an account is provided', () => {
      fixture.componentRef.setInput('account', null);
      fixture.detectChanges();
      expect(component.isEditMode()).toBe(false);

      fixture.componentRef.setInput('account', mockAccount);
      fixture.detectChanges();
      expect(component.isEditMode()).toBe(true);
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
        bankName: BankName.STANDARD,
      });

      component.onSubmit();

      expect(component.save.emit).toHaveBeenCalledWith({
        name: 'New Account',
        type: 'CHECKING',
        startingBalance: 100,
        currencyCode: 'USD',
        bankName: 'STANDARD',
      });
    });

    it(
      'bug regression: should keep a null bankName as null on create, not fall back to an empty ' +
        "string -- the empty string used to slip past the backend's null-only guard in " +
        "AccountDtoMapper and throw when the row was later read back (BankName.fromString('')), " +
        'breaking GET /accounts for the whole user, not just the account with no bank',
      () => {
        vi.spyOn(component.save, 'emit');
        fixture.componentRef.setInput('account', null);

        component.form.patchValue({
          name: 'New Account',
          type: mockAccountTypes[0],
          currencyCode: 'USD',
          currentBalance: 100,
          bankName: null,
        });

        component.onSubmit();

        expect(component.save.emit).toHaveBeenCalledWith(
          expect.objectContaining({
            bankName: null,
          }),
        );
      },
    );

    it('should emit update request when account is provided', () => {
      vi.spyOn(component.save, 'emit');
      fixture.componentRef.setInput('account', mockAccount);

      // onShow usually patches the form, we simulate this
      component.onShow();

      // User modifies name
      component.form.patchValue({
        name: 'Updated Name',
        bankName: BankName.CAPITAL_ONE,
      });

      component.onSubmit();

      expect(component.save.emit).toHaveBeenCalledWith({
        id: mockAccount.id,
        name: 'Updated Name',
        type: 'CHECKING',
        currencyCode: 'USD',
        bankName: 'CAPITAL_ONE',
        version: mockAccount.version,
      });
    });

    it('bug regression: should keep a null bankName as null on update too, not fall back to an empty string', () => {
      vi.spyOn(component.save, 'emit');
      fixture.componentRef.setInput('account', mockAccount);

      component.onShow();

      component.form.patchValue({
        bankName: null,
      });

      component.onSubmit();

      expect(component.save.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          bankName: null,
        }),
      );
    });
  });

  describe('as a panel body', () => {
    it("should show the account's current type selected even when the account's type object differs from the option list entry", () => {
      // arrange -- the /accounts payload's type has different sortOrder/isActive than /account-types
      const accountWithLooseType = {
        ...mockAccount,
        type: { ...mockAccountTypes[0], sortOrder: null as unknown as number, isActive: false },
      } as Account;

      // act
      fixture.componentRef.setInput('account', accountWithLooseType);
      fixture.detectChanges();

      // assert & verify
      const label: HTMLElement = fixture.nativeElement.querySelector(
        '#type-label ~ p-select .p-select-label',
      );
      expect(label.textContent?.trim()).toBe('Checking');
    });

    it('should keep what the user typed when the same account is refreshed in the background', () => {
      // arrange
      fixture.componentRef.setInput('account', mockAccount);
      fixture.detectChanges();
      component.form.patchValue({ name: 'TYPED' });

      // act -- a reload hands the form a new object for the same account
      fixture.componentRef.setInput('account', { ...mockAccount });
      fixture.detectChanges();

      // assert & verify
      expect(component.form.getRawValue().name).toBe('TYPED');
    });

    it('should reset when a different account is shown, and when switching to add', () => {
      // arrange
      fixture.componentRef.setInput('account', mockAccount);
      fixture.detectChanges();

      // act and assert & verify
      fixture.componentRef.setInput('account', { ...mockAccount, id: 99, name: 'OTHER' });
      fixture.detectChanges();
      expect(component.form.getRawValue().name).toBe('OTHER');

      fixture.componentRef.setInput('account', null);
      fixture.detectChanges();
      expect(component.form.getRawValue().name).toBe('');
      expect(component.isEditMode()).toBe(false);
    });

    it('should say what is missing, in words, after saving an incomplete form, and send nothing', () => {
      // arrange
      const saved = vi.fn();
      component.save.subscribe(saved);
      expect(fixture.nativeElement.querySelector('[data-testid="name-error"]')).toBeNull();

      // act
      component.submit();
      fixture.detectChanges();

      // assert & verify
      expect(saved).not.toHaveBeenCalled();
      expect(
        fixture.nativeElement.querySelector('[data-testid="name-error"]').textContent,
      ).toContain('Name is required.');
      expect(
        fixture.nativeElement.querySelector('[data-testid="type-error"]').textContent,
      ).toContain('Choose an account type.');
    });

    it('should label the balance Initial when adding and show the reconcile note when editing', () => {
      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('Initial balance');
      expect(fixture.nativeElement.textContent).not.toContain('Change the balance by reconciling.');

      // act
      fixture.componentRef.setInput('account', mockAccount);
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('Current balance');
      expect(fixture.nativeElement.textContent).toContain('Change the balance by reconciling.');
    });
  });

  // PF-880: the fill happens at init, and the effect's first run must not redo it over what was typed
  describe('init and the first render', () => {
    const fresh = (account: Account | null): AccountEditFormComponent => {
      const f = TestBed.createComponent(AccountEditFormComponent);
      f.componentRef.setInput('accountTypes', mockAccountTypes);
      f.componentRef.setInput('account', account);
      fixture = f;
      return f.componentInstance;
    };

    it('should fill its fields at init, before any effect or render', () => {
      // arrange -- inputs set, but no change detection yet (no effect has run)
      const c = fresh(mockAccount);

      // act
      c.ngOnInit();

      // assert & verify
      expect(c.form.getRawValue().name).toBe('Existing Account');
      expect(c.form.getRawValue().currencyCode).toBe('USD');
    });

    it('should not reset again on the first render (typing survives it)', () => {
      // arrange
      const c = fresh(null);
      c.ngOnInit();
      c.form.patchValue({ name: 'Typed early' });

      // act -- the first render and its effects run now
      fixture.detectChanges();

      // assert & verify
      expect(c.form.getRawValue().name).toBe('Typed early');
    });

    it('should still reset when another account is shown', () => {
      // arrange
      const c = fresh(null);
      fixture.detectChanges();
      c.form.patchValue({ name: 'Typed' });

      // act
      fixture.componentRef.setInput('account', mockAccount);
      fixture.detectChanges();

      // assert & verify
      expect(c.form.getRawValue().name).toBe('Existing Account');
    });
  });
});
