import { vi } from 'vitest';
import {ComponentFixture, TestBed, fakeAsync, tick} from '@angular/core/testing';
import {ReconcileDialogComponent} from './reconcile-dialog.component';
import {AccountApiService} from '@features/accounts/services/account-api.service';
import {ToastService} from '@core/services/toast.service';
import {Account} from '@models/account.model';
import {of, throwError} from 'rxjs';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';

describe('ReconcileDialogComponent', () => {
  let component: ReconcileDialogComponent;
  let fixture: ComponentFixture<ReconcileDialogComponent>;
  let mockAccountApiService: any;
  let mockToastService: any;

  const mockAccount = {
    id: 1,
    currentBalance: 100,
    version: 1
  } as Account;

  beforeEach(async () => {
    mockAccountApiService = { reconcile: vi.fn() };
    mockToastService = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ReconcileDialogComponent, NoopAnimationsModule],
      providers: [
        {provide: AccountApiService, useValue: mockAccountApiService},
        {provide: ToastService, useValue: mockToastService}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReconcileDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('account', mockAccount);
    fixture.componentRef.setInput('visible', true);
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
      id: mockAccount.id,
      newBalance: 150,
      version: mockAccount.version
    });
    expect(mockToastService.success).toHaveBeenCalledWith('Account reconciled successfully');
    expect(component.reconciled.emit).toHaveBeenCalled();
    expect(component.visible()).toBe(false);
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

  it('should close dialog on cancel', () => {
    fixture.detectChanges();
    component.onCancel();
    expect(component.visible()).toBe(false);
  });

  it('should reset form and error message when visibility becomes false', async () => {
    fixture.detectChanges();
    component.form.controls.targetBalance.setValue(150);
    component.errorMessage.set('Some error');
    
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.form.controls.targetBalance.value).toBeNull();
    expect(component.errorMessage()).toBeNull();
  });
});
