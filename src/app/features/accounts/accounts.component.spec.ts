import { vi } from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {AccountsComponent} from './accounts.component';
import {AccountApiService} from './services/account-api.service';
import {ToastService} from '@core/services/toast.service';
import {ConfirmationService} from 'primeng/api';
import {Account, AccountCreateRequest, AccountType, AccountUpdateRequest, BankName} from '@models/account.model';
import {of, throwError} from 'rxjs';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';

describe('AccountsComponent', () => {
  let component: AccountsComponent;
  let fixture: ComponentFixture<AccountsComponent>;
  let mockAccountApi: any;
  let mockToast: any;
  let mockConfirmationService: any;

  const mockAccountTypes: AccountType[] = [
    { code: 'CHECKING', label: 'Checking', isAsset: true, sortOrder: 1, isActive: true, icon: 'pi', color: 'blue' }
  ];

  const mockAccounts: Account[] = [
    {
      id: 1,
      name: 'Test Checking',
      type: mockAccountTypes[0],
      currentBalance: 1000,
      currency: { code: 'USD', name: 'US Dollar', symbol: '$', isActive: true },
      bank: BankName.STANDARD,
      version: 1,
      user: { id: 1 }
    } as Account
  ];

  beforeEach(async () => {
    mockAccountApi = { getAccounts: vi.fn(), getAccountTypes: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    mockToast = { success: vi.fn(), error: vi.fn() };
    mockConfirmationService = { confirm: vi.fn() };

    mockAccountApi.getAccounts.mockReturnValue(of(mockAccounts));
    mockAccountApi.getAccountTypes.mockReturnValue(of(mockAccountTypes));

    await TestBed.configureTestingModule({
      imports: [AccountsComponent, NoopAnimationsModule],
      providers: [
        { provide: AccountApiService, useValue: mockAccountApi },
        { provide: ToastService, useValue: mockToast },
        { provide: ConfirmationService, useValue: mockConfirmationService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AccountsComponent);
    component = fixture.componentInstance;
  });

  it('should create and load data on init', () => {
    fixture.detectChanges(); // Triggers ngOnInit
    
    expect(component).toBeTruthy();
    expect(mockAccountApi.getAccounts).toHaveBeenCalled();
    expect(mockAccountApi.getAccountTypes).toHaveBeenCalled();
    
    expect(component.accounts()).toEqual(mockAccounts);
    expect(component.accountTypes()).toEqual(mockAccountTypes);
    expect(component.loading()).toBe(false);
    expect(component.isEmpty()).toBe(false);
  });

  it('should handle load error gracefully', () => {
    mockAccountApi.getAccounts.mockReturnValue(throwError(() => new Error('Network error')));
    
    fixture.detectChanges();
    
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load accounts');
    expect(component.loading()).toBe(false);
  });

  describe('dialog operations', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should open create dialog', () => {
      component.openCreateDialog();
      expect(component.selectedAccount()).toBeNull();
      expect(component.showDialog()).toBe(true);
    });

    it('should open edit dialog', () => {
      component.openEditDialog(mockAccounts[0]);
      expect(component.selectedAccount()).toEqual(mockAccounts[0]);
      expect(component.showDialog()).toBe(true);
    });
  });

  describe('onSave', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should route to createAccount when selectedAccount is null', () => {
      component.selectedAccount.set(null);
      const createReq: AccountCreateRequest = { name: 'New', type: 'CHECKING', startingBalance: 0, currencyCode: 'USD', bankName: 'STANDARD' };
      
      mockAccountApi.create.mockReturnValue(of(2));
      
      component.onSave(createReq);
      
      expect(mockAccountApi.create).toHaveBeenCalledWith(createReq);
      expect(mockToast.success).toHaveBeenCalledWith('Account created successfully');
      expect(component.showDialog()).toBe(false);
      expect(mockAccountApi.getAccounts).toHaveBeenCalledTimes(2); // Initial load + reload
    });

    it('should handle createAccount error', () => {
      component.selectedAccount.set(null);
      mockAccountApi.create.mockReturnValue(throwError(() => ({ error: { detail: 'Create error' } })));
      
      component.onSave({} as AccountCreateRequest);
      
      expect(mockToast.error).toHaveBeenCalledWith('Create error');
    });

    it('should route to editAccount when selectedAccount exists', () => {
      component.selectedAccount.set(mockAccounts[0]);
      const updateReq: AccountUpdateRequest = { id: 1, name: 'Updated', type: 'CHECKING', currencyCode: 'USD', bankName: 'STANDARD', version: 1 };
      
      mockAccountApi.update.mockReturnValue(of(1));
      
      component.onSave(updateReq);
      
      expect(mockAccountApi.update).toHaveBeenCalledWith(updateReq);
      expect(mockToast.success).toHaveBeenCalledWith('Account updated successfully');
      expect(component.showDialog()).toBe(false);
      expect(mockAccountApi.getAccounts).toHaveBeenCalledTimes(2);
    });

    it('should handle editAccount error with fallback message', () => {
      component.selectedAccount.set(mockAccounts[0]);
      mockAccountApi.update.mockReturnValue(throwError(() => ({})));
      
      component.onSave({} as AccountUpdateRequest);
      
      expect(mockToast.error).toHaveBeenCalledWith('Failed to update account');
    });
  });

  describe('deleteAccount', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should open confirmation and delete upon accept', () => {
      // Setup mock confirmation to instantly trigger 'accept'
      mockConfirmationService.confirm.mockImplementation((config: any) => {
        if (config.accept) {
          config.accept();
        }
        return mockConfirmationService;
      });

      mockAccountApi.delete.mockReturnValue(of(undefined));

      component.deleteAccount(mockAccounts[0]);

      expect(mockConfirmationService.confirm).toHaveBeenCalled();
      expect(mockAccountApi.delete).toHaveBeenCalledWith(mockAccounts[0].id);
      expect(mockToast.success).toHaveBeenCalledWith('Account deleted successfully');
      
      // Account should be removed from the signal
      expect(component.accounts().length).toBe(0);
    });

    it('should handle delete error', () => {
      mockConfirmationService.confirm.mockImplementation((config: any) => {
        if (config.accept) {
          config.accept();
        }
        return mockConfirmationService;
      });

      mockAccountApi.delete.mockReturnValue(throwError(() => ({ error: { detail: 'Cannot delete' } })));

      component.deleteAccount(mockAccounts[0]);

      expect(mockToast.error).toHaveBeenCalledWith('Cannot delete');
    });

    it('should handle delete error with fallback message', () => {
      mockConfirmationService.confirm.mockImplementation((config: any) => {
        if (config.accept) {
          config.accept();
        }
        return mockConfirmationService;
      });

      mockAccountApi.delete.mockReturnValue(throwError(() => ({})));

      component.deleteAccount(mockAccounts[0]);

      expect(mockToast.error).toHaveBeenCalledWith('Failed to delete account');
    });
  });
});
