import { vi, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountReconcileFormComponent } from './account-reconcile-form.component';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { ToastService } from '@core/services/toast.service';
import { Account } from '@models/account.model';
import { of, throwError } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('AccountReconcileFormComponent', () => {
  let component: AccountReconcileFormComponent;
  let fixture: ComponentFixture<AccountReconcileFormComponent>;
  let mockAccountApiService: Mocked<Pick<AccountApiService, 'reconcile'>>;
  let mockToastService: Mocked<Pick<ToastService, 'success' | 'error'>>;

  const mockAccount = {
    id: 1,
    name: 'Checking',
    currentBalance: 100,
    currency: { code: 'USD', name: 'US Dollar', symbol: '$', isActive: true },
    version: 1,
  } as Account;

  beforeEach(async () => {
    mockAccountApiService = { reconcile: vi.fn() };
    mockToastService = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AccountReconcileFormComponent, NoopAnimationsModule],
      providers: [
        { provide: AccountApiService, useValue: mockAccountApiService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountReconcileFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('account', mockAccount);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should calculate difference correctly', () => {
    fixture.detectChanges();

    // Initial state, form value is null, difference should be 0
    expect(component.difference()).toBe(0);

    // Set target balance
    component.form.controls.targetBalance.setValue(150);
    fixture.detectChanges();

    // target(150) - current(100) = 50
    expect(component.difference()).toBe(50);

    // Set lower target balance
    component.form.controls.targetBalance.setValue(80);
    fixture.detectChanges();

    // target(80) - current(100) = -20
    expect(component.difference()).toBe(-20);
  });

  it('should not submit if form is invalid', () => {
    fixture.detectChanges();
    vi.spyOn(component.form, 'markAllAsTouched');

    component.form.controls.targetBalance.setValue(null);
    component.submit();

    expect(component.form.markAllAsTouched).toHaveBeenCalled();
    expect(mockAccountApiService.reconcile).not.toHaveBeenCalled();
  });

  it('should not submit if already saving', () => {
    fixture.detectChanges();

    component.form.controls.targetBalance.setValue(150);
    component.saving.set(true);
    component.submit();

    expect(mockAccountApiService.reconcile).not.toHaveBeenCalled();
  });

  it('should submit successfully', () => {
    fixture.detectChanges();
    vi.spyOn(component.reconciled, 'emit');
    mockAccountApiService.reconcile.mockReturnValue(of(1));

    component.form.controls.targetBalance.setValue(150);
    component.submit();

    expect(component.saving()).toBe(false);
    expect(mockAccountApiService.reconcile).toHaveBeenCalledWith({
      accountId: mockAccount.id,
      newBalance: 150,
      version: mockAccount.version,
    });
    expect(mockToastService.success).toHaveBeenCalledWith('Account reconciled successfully');
    expect(component.reconciled.emit).toHaveBeenCalledWith({ adjustment: 50 });
  });

  describe('onBalanceKeyDown', () => {
    it('should submit on Enter', () => {
      fixture.detectChanges();
      mockAccountApiService.reconcile.mockReturnValue(of(1));
      component.form.controls.targetBalance.setValue(150);

      component.onBalanceKeyDown({ key: 'Enter' } as KeyboardEvent);

      expect(mockAccountApiService.reconcile).toHaveBeenCalled();
    });

    it('should not submit on other keys, e.g. a digit being typed', () => {
      fixture.detectChanges();
      component.form.controls.targetBalance.setValue(150);

      component.onBalanceKeyDown({ key: '1' } as KeyboardEvent);

      expect(mockAccountApiService.reconcile).not.toHaveBeenCalled();
    });
  });

  it('should handle submit error', () => {
    fixture.detectChanges();
    const errorResponse = { error: { detail: 'Backend error' } };
    mockAccountApiService.reconcile.mockReturnValue(throwError(() => errorResponse));

    component.form.controls.targetBalance.setValue(150);
    component.submit();

    expect(component.saving()).toBe(false);
    expect(component.errorMessage()).toBe('Backend error');
    expect(mockToastService.success).not.toHaveBeenCalled();
  });

  it('should handle submit error with fallback message', () => {
    fixture.detectChanges();
    mockAccountApiService.reconcile.mockReturnValue(throwError(() => ({})));

    component.form.controls.targetBalance.setValue(150);
    component.submit();

    expect(component.saving()).toBe(false);
    expect(component.errorMessage()).toBe('Failed to reconcile account');
  });

  it('should treat float noise as balanced and never post', () => {
    // arrange
    fixture.componentRef.setInput('account', { ...mockAccount, currentBalance: 0.3 });
    fixture.detectChanges();
    component.form.controls.targetBalance.setValue(0.1 + 0.2);

    // act
    component.submit();

    // assert & verify
    expect(component.difference()).toBe(0);
    expect(component.balanced()).toBe(true);
    expect(mockAccountApiService.reconcile).not.toHaveBeenCalled();
  });

  it('should compute the adjustment in cents', () => {
    // arrange
    fixture.componentRef.setInput('account', { ...mockAccount, currentBalance: 4820.15 });
    fixture.detectChanges();

    // act
    component.form.controls.targetBalance.setValue(4832.55);

    // assert & verify
    expect(component.difference()).toBe(12.4);
  });

  it('should show a version conflict inline, stay on the step and ask the host to reload', () => {
    // arrange
    fixture.detectChanges();
    mockAccountApiService.reconcile.mockReturnValue(
      throwError(() => ({ error: { detail: 'Account was changed by someone else' } })),
    );
    const reload = vi.fn();
    component.reloadRequested.subscribe(reload);
    component.form.controls.targetBalance.setValue(150);

    // act
    component.submit();
    fixture.detectChanges();

    // assert & verify
    expect(
      fixture.nativeElement.querySelector('[data-testid="reconcile-error"]').textContent,
    ).toContain('changed by someone else');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('should keep what was typed when the same account is refreshed, and reset for another account', () => {
    // arrange
    fixture.detectChanges();
    component.form.controls.targetBalance.setValue(1200);

    // act and assert & verify
    fixture.componentRef.setInput('account', { ...mockAccount, version: 2 });
    fixture.detectChanges();
    expect(component.form.value.targetBalance).toBe(1200);

    fixture.componentRef.setInput('account', { ...mockAccount, id: 2 });
    fixture.detectChanges();
    expect(component.form.value.targetBalance).toBeNull();
  });

  // PF-880
  describe('init and the first render', () => {
    it('should not reset again on the first render (typing survives it)', () => {
      // arrange
      component.ngOnInit();
      component.form.controls.targetBalance.setValue(150);

      // act -- the first render and its effects run now
      fixture.detectChanges();

      // assert & verify
      expect(component.form.controls.targetBalance.value).toBe(150);
    });

    it('should start empty at init', () => {
      // act
      component.ngOnInit();

      // assert & verify
      expect(component.form.controls.targetBalance.value).toBeNull();
      expect(component.errorMessage()).toBeNull();
    });

    it('should still reset when another account is shown', () => {
      // arrange
      fixture.detectChanges();
      component.form.controls.targetBalance.setValue(150);

      // act
      fixture.componentRef.setInput('account', { ...mockAccount, id: 2 });
      fixture.detectChanges();

      // assert & verify
      expect(component.form.controls.targetBalance.value).toBeNull();
    });
  });
});
