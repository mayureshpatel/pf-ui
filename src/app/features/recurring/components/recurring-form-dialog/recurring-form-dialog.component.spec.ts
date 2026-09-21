import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { RecurringFormDialogComponent } from './recurring-form-dialog.component';
import { RecurringApiService } from '../../services/recurring-api.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/auth/auth.service';
import { Account } from '@models/account.model';
import { Merchant } from '@models/merchant.model';
import { RecurringSuggestion, RecurringTransaction } from '@models/recurring.model';
import { User } from '@models/auth.model';

describe('RecurringFormDialogComponent', () => {
  let component: RecurringFormDialogComponent;
  let fixture: ComponentFixture<RecurringFormDialogComponent>;
  let mockRecurringApi: any;
  let mockToast: any;
  let mockAuth: any;

  const checking = {
    id: 1,
    name: 'Checking',
    type: { label: 'Checking Account' },
  } as unknown as Account;
  const netflix = {
    id: 1,
    userId: 1,
    name: 'Netflix',
    city: null,
    state: null,
    postalCode: null,
    country: null,
  } as Merchant;
  const rawCo = {
    id: 2,
    userId: 1,
    name: 'RAW CO',
    city: null,
    state: null,
    postalCode: null,
    country: null,
  } as Merchant;
  const mockAccounts: Account[] = [checking];
  const mockMerchants: Merchant[] = [netflix, rawCo];
  const mockUser: User = { id: 42, username: 'jdoe', email: 'jdoe@test.com' };

  beforeEach(async () => {
    mockRecurringApi = {
      create: vi.fn().mockReturnValue(of({})),
      update: vi.fn().mockReturnValue(of({})),
    };
    mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    mockAuth = { user: signal<User | null>(mockUser) };

    await TestBed.configureTestingModule({
      imports: [RecurringFormDialogComponent],
      providers: [
        { provide: RecurringApiService, useValue: mockRecurringApi },
        { provide: ToastService, useValue: mockToast },
        { provide: AuthService, useValue: mockAuth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecurringFormDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('accounts', mockAccounts);
    fixture.componentRef.setInput('merchants', mockMerchants);
    fixture.detectChanges();
  });

  // Fills the form with a complete, valid set of values.
  const fillValidForm = (): void => {
    component.form.setValue({
      accountId: 1,
      merchantId: 1,
      amount: 15.99,
      frequency: 'MONTHLY',
      nextDate: new Date(2099, 0, 1),
      active: true,
    });
  };

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('isEditMode', () => {
    it('should be false when no existing recurring entry is provided', () => {
      expect(component.isEditMode()).toBe(false);
    });

    it('should be true when an existing recurring entry is provided', () => {
      fixture.componentRef.setInput('recurring', { id: 5 } as RecurringTransaction);
      fixture.detectChanges();

      expect(component.isEditMode()).toBe(true);
    });
  });

  describe('derived dropdown options', () => {
    it("should label accounts with their name and include the account type's label", () => {
      expect(component.accountOptions()).toEqual([
        { label: 'Checking', value: 1, type: 'Checking Account' },
      ]);
    });

    it('should label merchants by their name', () => {
      expect(component.merchantOptions()).toEqual([
        { label: 'Netflix', value: 1 },
        { label: 'RAW CO', value: 2 },
      ]);
    });
  });

  describe('onShow', () => {
    it('should reset to a blank, active-by-default form in create mode', () => {
      // arrange -- dirty the form first
      fillValidForm();

      // act
      component.onShow();

      // assert & verify
      expect(component.form.controls.accountId.value).toBeNull();
      expect(component.form.controls.merchantId.value).toBeNull();
      expect(component.form.controls.active.value).toBe(true);
      expect(component.errorMessage()).toBeNull();
    });

    it('should patch every field, including the account, from an existing entry in edit mode', () => {
      // arrange
      const rec: RecurringTransaction = {
        id: 9,
        userId: 42,
        account: checking,
        merchant: netflix,
        amount: 15.99,
        frequency: 'MONTHLY',
        nextDate: '2026-06-15',
        active: false,
      };
      fixture.componentRef.setInput('recurring', rec);

      // act
      component.onShow();

      // assert & verify
      expect(component.form.controls.accountId.value).toBe(1);
      expect(component.form.controls.merchantId.value).toBe(1);
      expect(component.form.controls.amount.value).toBe(15.99);
      expect(component.form.controls.frequency.value).toBe('MONTHLY');
      expect(component.form.controls.active.value).toBe(false);
    });

    it('should patch merchant/amount/frequency/date from a suggestion, always as active, with no account', () => {
      // arrange
      const sug: RecurringSuggestion = {
        merchant: netflix,
        amount: 9.99,
        frequency: 'MONTHLY',
        lastDate: '2026-05-15',
        nextDate: '2026-06-15',
        occurrenceCount: 3,
        confidenceScore: 0.9,
      };
      fixture.componentRef.setInput('suggestion', sug);

      // act
      component.onShow();

      // assert & verify
      expect(component.form.controls.merchantId.value).toBe(1);
      expect(component.form.controls.amount.value).toBe(9.99);
      expect(component.form.controls.accountId.value).toBeNull();
      expect(component.form.controls.active.value).toBe(true);
    });
  });

  describe('form validation', () => {
    it('should be invalid when blank', () => {
      expect(component.form.invalid).toBe(true);
    });

    it('should reject an amount below the minimum', () => {
      component.form.controls.amount.setValue(0);

      expect(component.form.controls.amount.invalid).toBe(true);
    });

    it('should reject an amount above the maximum', () => {
      component.form.controls.amount.setValue(100000000);

      expect(component.form.controls.amount.invalid).toBe(true);
    });

    it('should reject a next-payment date that is today or in the past', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      component.form.controls.nextDate.setValue(today);

      expect(component.form.controls.nextDate.errors).toEqual({ notFuture: true });
    });

    it('should accept a next-payment date in the future', () => {
      component.form.controls.nextDate.setValue(new Date(2099, 0, 1));

      expect(component.form.controls.nextDate.errors).toBeNull();
    });

    it('should not call the API and should touch all controls when submitted while invalid', () => {
      component.onSubmit();

      expect(mockRecurringApi.create).not.toHaveBeenCalled();
      expect(component.form.controls.accountId.touched).toBe(true);
      expect(component.form.controls.nextDate.touched).toBe(true);
    });
  });

  describe('onSubmit', () => {
    it('should reject submission when no user is authenticated', () => {
      // arrange
      mockAuth.user.set(null);
      fillValidForm();

      // act
      component.onSubmit();

      // assert & verify
      expect(mockRecurringApi.create).not.toHaveBeenCalled();
      expect(component.errorMessage()).toBe('User authentication session expired.');
    });

    it('should ignore a resubmit while a save is already in flight', () => {
      fillValidForm();
      component.loading.set(true);

      component.onSubmit();

      expect(mockRecurringApi.create).not.toHaveBeenCalled();
    });

    describe('create mode (no recurring input)', () => {
      it('should call create() with the userId and form values', () => {
        fillValidForm();

        component.onSubmit();

        expect(mockRecurringApi.create).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 42,
            accountId: 1,
            merchantId: 1,
            amount: 15.99,
            frequency: 'MONTHLY',
            active: true,
          }),
        );
        expect(mockRecurringApi.update).not.toHaveBeenCalled();
      });

      it('should toast success, emit saved, and close the dialog on success', () => {
        const savedSpy = vi.fn();
        component.saved.subscribe(savedSpy);
        fillValidForm();

        component.onSubmit();

        expect(mockToast.success).toHaveBeenCalledWith('Recurring entry created');
        expect(savedSpy).toHaveBeenCalled();
        expect(component.visible()).toBe(false);
      });
    });

    describe('edit mode (recurring input present)', () => {
      beforeEach(() => {
        fixture.componentRef.setInput('recurring', { id: 9 } as RecurringTransaction);
        fixture.detectChanges();
      });

      it("should call update() with the record's id, not create()", () => {
        fillValidForm();

        component.onSubmit();

        expect(mockRecurringApi.update).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 9,
            accountId: 1,
            merchantId: 1,
            amount: 15.99,
            frequency: 'MONTHLY',
            active: true,
          }),
        );
        expect(mockRecurringApi.create).not.toHaveBeenCalled();
      });

      it('should toast a distinct update-success message', () => {
        fillValidForm();

        component.onSubmit();

        expect(mockToast.success).toHaveBeenCalledWith('Recurring entry updated');
      });
    });

    describe('API failure', () => {
      it('should surface the detail message, stop loading, and keep the dialog open', () => {
        mockRecurringApi.create.mockReturnValue(
          throwError(() => ({ error: { detail: 'Duplicate schedule' } })),
        );
        fillValidForm();

        component.onSubmit();

        expect(component.errorMessage()).toBe('Duplicate schedule');
        expect(component.loading()).toBe(false);
        expect(component.visible()).toBe(true);
      });

      it('should fall back to a generic message when the API error has no detail', () => {
        mockRecurringApi.create.mockReturnValue(throwError(() => ({ error: {} })));
        fillValidForm();

        component.onSubmit();

        expect(component.errorMessage()).toBe('Failed to create entry');
      });
    });
  });

  // Regression: onShow()/onSubmit() previously round-tripped `nextDate` through UTC-anchored
  // conversions (`.toISOString()` on a local-midnight Date; `new Date(bareDateString)`, which
  // always parses as UTC midnight). Both silently roll the calendar day backward by one for a
  // browser in a positive UTC offset -- the exact bug class already found and fixed in the
  // Reports feature (PF-336) via `toLocalDateString`/`fromLocalDateString`, now fixed here the
  // same way. `verify.sh`'s real quality gate runs these specs inside an actual Chromium browser
  // (not jsdom), which has no `process` global at all -- so unlike a Node-only test, the
  // system timezone genuinely cannot be pinned here. Instead this mirrors
  // `transaction.utils.spec.ts`'s own already-established technique for this exact function pair:
  // spy on a specific Date instance's local getters to simulate what a positive-offset browser's
  // getFullYear/getMonth/getDate would report, independent of whatever timezone the machine
  // actually running the test happens to be in.
  describe('local-date handling (regression, UTC round-trip)', () => {
    it('should submit the date via its local getters, not a UTC-shifted toISOString value', () => {
      // arrange -- the real UTC instant is June 14 15:30 UTC; local getters are mocked to report
      // what a positive-UTC-offset browser would show for that same instant: June 15 local.
      // toISOString() is deliberately left un-mocked, so it still reflects the real UTC value.
      const pickedDate = new Date(Date.UTC(2099, 5, 14, 15, 30, 0));
      vi.spyOn(pickedDate, 'getFullYear').mockReturnValue(2099);
      vi.spyOn(pickedDate, 'getMonth').mockReturnValue(5); // June, 0-indexed
      vi.spyOn(pickedDate, 'getDate').mockReturnValue(15);
      component.form.setValue({
        accountId: 1,
        merchantId: 1,
        amount: 10,
        frequency: 'MONTHLY',
        nextDate: pickedDate,
        active: true,
      });

      // act
      component.onSubmit();

      // assert & verify -- "2099-06-14" would mean it's still reading toISOString(), not the
      // (mocked) local getters
      expect(mockRecurringApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ nextDate: '2099-06-15' }),
      );
    });

    it('should parse a stored date string to local midnight on the same day, not UTC midnight', () => {
      // arrange -- fromLocalDateString's own correctness (independent of the running machine's
      // timezone, by construction of the 3-argument Date constructor) is already covered by
      // transaction.utils.spec.ts; this only confirms onShow() actually delegates to it instead
      // of the bare `new Date(dateString)` constructor it used before the fix.
      const rec: RecurringTransaction = {
        id: 9,
        userId: 42,
        account: checking,
        merchant: netflix,
        amount: 15.99,
        frequency: 'MONTHLY',
        nextDate: '2099-06-15',
        active: true,
      };
      fixture.componentRef.setInput('recurring', rec);

      // act
      component.onShow();
      const value: Date = component.form.controls.nextDate.value!;

      // assert & verify -- the 3-argument constructor guarantees these match on any machine;
      // `new Date('2099-06-15')` (UTC midnight) would only match them too on a UTC-exactly one
      expect(value.getFullYear()).toBe(2099);
      expect(value.getMonth()).toBe(5);
      expect(value.getDate()).toBe(15);
    });
  });
});
