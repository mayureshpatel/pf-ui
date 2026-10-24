import { vi, Mock, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { AccountsComponent } from './accounts.component';
import { AccountApiService } from './services/account-api.service';
import { AccountEditFormComponent } from './components/account-edit-form/account-edit-form.component';
import { ToastService } from '@core/services/toast.service';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { Account, AccountType, BankName } from '@models/account.model';
import { of, Subject, throwError } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('AccountsComponent', () => {
  let component: AccountsComponent;
  let fixture: ComponentFixture<AccountsComponent>;
  let mockAccountApi: Mocked<
    Pick<AccountApiService, 'getAccounts' | 'getAccountTypes' | 'create' | 'update' | 'delete'>
  >;
  let mockToast: Mocked<Pick<ToastService, 'success' | 'error'>>;
  let mockConfirmationService: { confirm: Mock<(confirmation: Confirmation) => void> };
  let mockRouter: { navigate: Mock };

  const checking: AccountType = {
    code: 'CHECKING',
    label: 'Checking',
    isAsset: true,
    sortOrder: 1,
    isActive: true,
    icon: 'pi-wallet',
    color: 'text-emerald-600',
  };
  const credit: AccountType = { ...checking, code: 'CREDIT', label: 'Credit', isAsset: false };

  const acct = (id: number, name: string, balance: number, isAsset: boolean): Account =>
    ({
      id,
      name,
      type: isAsset ? checking : credit,
      currentBalance: balance,
      currency: { code: 'USD', name: 'US Dollar', symbol: '$', isActive: true },
      bank: BankName.STANDARD,
      version: 1,
      user: { id: 1 },
    }) as Account;

  function loadWith(list: Account[]): void {
    mockAccountApi.getAccounts.mockReturnValue(of(list));
    component.loadAccounts();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockAccountApi = {
      getAccounts: vi.fn(),
      getAccountTypes: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    mockToast = { success: vi.fn(), error: vi.fn() };
    mockConfirmationService = { confirm: vi.fn() };
    mockRouter = { navigate: vi.fn() };

    mockAccountApi.getAccounts.mockReturnValue(of([acct(1, 'Checking', 100, true)]));
    mockAccountApi.getAccountTypes.mockReturnValue(of([checking, credit]));

    await TestBed.configureTestingModule({
      imports: [AccountsComponent, NoopAnimationsModule],
      providers: [
        { provide: AccountApiService, useValue: mockAccountApi },
        { provide: ToastService, useValue: mockToast },
        { provide: ConfirmationService, useValue: mockConfirmationService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('loading', () => {
    it('should load accounts and types on init', () => {
      // assert & verify
      expect(mockAccountApi.getAccounts).toHaveBeenCalled();
      expect(mockAccountApi.getAccountTypes).toHaveBeenCalled();
      expect(component.accountTypes()).toEqual([checking, credit]);
      expect(component.loading()).toBe(false);
    });

    it('should toast and flag the error when loading fails', () => {
      // arrange -- nothing loaded yet, so the error state replaces the page
      component.accounts.set([]);
      mockAccountApi.getAccounts.mockReturnValue(throwError(() => new Error('down')));

      // act
      component.loadAccounts();
      fixture.detectChanges();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Failed to load accounts');
      expect(component.loading()).toBe(false);
      expect(fixture.nativeElement.querySelector('app-page-error-state')).toBeTruthy();
    });
  });

  describe('panel flow', () => {
    it('should open the summary for a clicked account and highlight it', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true), acct(2, 'Visa', -50, false)]);

      // act
      component.openAccount(component.accounts()[1]);
      fixture.detectChanges();

      // assert & verify
      expect(component.panelMode()).toBe('account');
      expect(component.selectedAccount()?.id).toBe(2);
    });

    it('should open straight on Edit or Reconcile from the menu', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true)]);

      // act and assert & verify
      component.startReconcile(component.accounts()[0]);
      expect(component.panelMode()).toBe('reconcile');
      component.startEdit(component.accounts()[0]);
      expect(component.panelMode()).toBe('edit');
    });

    it('should go to the Transactions page filtered to the account, across all time', () => {
      // arrange
      loadWith([acct(7, 'Checking', 100, true)]);

      // act
      component.viewTransactions(component.accounts()[0]);

      // assert & verify
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/transactions'], {
        queryParams: { accountId: 7, period: 'all' },
      });
    });
  });

  describe('create', () => {
    it('should open the new account summary after creating, though create returns only an id', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true)]);
      mockAccountApi.create.mockReturnValue(of(9));
      mockAccountApi.getAccounts.mockReturnValue(
        of([acct(1, 'Checking', 100, true), acct(9, 'ZZ New', 0, true)]),
      );
      component.startCreate();

      // act
      component.onSave({
        name: 'ZZ New',
        type: 'CHECKING',
        startingBalance: 0,
        currencyCode: 'USD',
        bankName: null,
      });

      // assert & verify
      expect(component.panelMode()).toBe('account');
      expect(component.selectedAccount()?.id).toBe(9);
      expect(mockToast.success).toHaveBeenCalledWith('Account created successfully');
    });

    it('should toast the API message when creating fails', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true)]);
      mockAccountApi.create.mockReturnValue(
        throwError(() => ({ error: { detail: 'Create error' } })),
      );
      component.startCreate();

      // act
      component.onSave({
        name: 'x',
        type: 'CHECKING',
        startingBalance: 0,
        currencyCode: 'USD',
        bankName: null,
      });

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Create error');
      expect(component.panelMode()).toBe('create');
    });
  });

  describe('edit', () => {
    it('should return to the refreshed summary after saving an edit', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true)]);
      component.startEdit(component.accounts()[0]);
      mockAccountApi.update.mockReturnValue(of(1));
      mockAccountApi.getAccounts.mockReturnValue(of([acct(1, 'Renamed', 100, true)]));

      // act
      component.onSave({
        id: 1,
        name: 'Renamed',
        type: 'CHECKING',
        currencyCode: 'USD',
        bankName: null,
        version: 1,
      });

      // assert & verify
      expect(component.panelMode()).toBe('account');
      expect(component.selectedAccount()?.name).toBe('Renamed');
      expect(mockToast.success).toHaveBeenCalledWith('Account updated successfully');
    });

    it('should toast a fallback message when updating fails', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true)]);
      component.startEdit(component.accounts()[0]);
      mockAccountApi.update.mockReturnValue(throwError(() => ({})));

      // act
      component.onSave({
        id: 1,
        name: 'x',
        type: 'CHECKING',
        currencyCode: 'USD',
        bankName: null,
        version: 1,
      });

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Failed to update account');
      expect(component.panelMode()).toBe('edit');
    });
  });

  describe('reconcile', () => {
    it('should reload and return to the summary after a successful reconcile', () => {
      // arrange
      loadWith([acct(1, 'Checking', 1000, true)]);
      component.startReconcile(component.accounts()[0]);
      mockAccountApi.getAccounts.mockReturnValue(of([acct(1, 'Checking', 1200, true)]));

      // act
      component.onReconciled({ adjustment: 200 });

      // assert & verify
      expect(component.panelMode()).toBe('account');
      expect(component.selectedAccount()?.currentBalance).toBe(1200);
    });

    it('should reload the accounts when the reconcile step asks, without leaving the step', () => {
      // arrange
      loadWith([acct(1, 'Checking', 1000, true)]);
      component.startReconcile(component.accounts()[0]);
      mockAccountApi.getAccounts.mockClear();

      // act
      component.onReloadRequested();

      // assert & verify
      expect(mockAccountApi.getAccounts).toHaveBeenCalledTimes(1);
      expect(component.panelMode()).toBe('reconcile');
    });
  });

  describe('delete', () => {
    const acceptDelete = (): void => mockConfirmationService.confirm.mock.calls[0][0].accept!();

    it('should close the panel and drop the account when the shown account is deleted', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true), acct(2, 'Visa', -50, false)]);
      component.openAccount(component.accounts()[0]);
      mockAccountApi.delete.mockReturnValue(of(undefined));

      // act
      component.deleteAccount(component.accounts()[0]);
      acceptDelete();

      // assert & verify
      expect(component.accounts().map((a) => a.id)).toEqual([2]);
      expect(component.panelMode()).toBe('overview');
      expect(component.selectedId()).toBeNull();
      expect(mockToast.success).toHaveBeenCalledWith('Account deleted successfully');
    });

    it('should leave the panel alone when a different account is deleted', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true), acct(2, 'Visa', -50, false)]);
      component.openAccount(component.accounts()[0]);
      mockAccountApi.delete.mockReturnValue(of(undefined));

      // act
      component.deleteAccount(component.accounts()[1]);
      acceptDelete();

      // assert & verify
      expect(component.panelMode()).toBe('account');
      expect(component.selectedId()).toBe(1);
    });

    it('should toast the API message and keep the account when delete is refused', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true)]);
      mockAccountApi.delete.mockReturnValue(
        throwError(() => ({ error: { detail: 'Account has transactions' } })),
      );

      // act
      component.deleteAccount(component.accounts()[0]);
      acceptDelete();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Account has transactions');
      expect(component.accounts().length).toBe(1);
    });

    it('should toast a fallback message when delete fails without a detail', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true)]);
      mockAccountApi.delete.mockReturnValue(throwError(() => ({})));

      // act
      component.deleteAccount(component.accounts()[0]);
      acceptDelete();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Failed to delete account');
    });
  });

  describe('unsaved edits', () => {
    const dirtyEditForm = (): void => {
      fixture.detectChanges();
      const form = fixture.debugElement.query(By.directive(AccountEditFormComponent))
        .componentInstance as AccountEditFormComponent;
      form.form.markAsDirty();
    };

    it('should ask before leaving a dirty edit for another account, Back, or Close', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true), acct(2, 'B', 2, true)]);
      component.startEdit(component.accounts()[0]);
      dirtyEditForm();

      // act and assert & verify
      component.openAccount(component.accounts()[1]);
      expect(mockConfirmationService.confirm).toHaveBeenCalledTimes(1);
      expect(component.selectedId()).toBe(1);

      component.back();
      expect(mockConfirmationService.confirm).toHaveBeenCalledTimes(2);

      component.onPanelClose();
      expect(mockConfirmationService.confirm).toHaveBeenCalledTimes(3);
      expect(component.panelMode()).toBe('edit');
    });

    it('should not ask when the form is untouched', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true), acct(2, 'B', 2, true)]);
      component.startEdit(component.accounts()[0]);
      fixture.detectChanges();

      // act
      component.openAccount(component.accounts()[1]);

      // assert & verify
      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
      expect(component.selectedId()).toBe(2);
    });

    it('should proceed when the user chooses Discard', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true), acct(2, 'B', 2, true)]);
      component.startEdit(component.accounts()[0]);
      dirtyEditForm();
      component.openAccount(component.accounts()[1]);

      // act
      mockConfirmationService.confirm.mock.calls[0][0].accept!();

      // assert & verify
      expect(component.selectedId()).toBe(2);
      expect(component.panelMode()).toBe('account');
    });
  });

  describe('states', () => {
    it('should show a busy skeleton, not the empty state, while the first load is in flight', () => {
      // arrange
      component.accounts.set([]);
      component.loading.set(true);

      // act
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.querySelector('[aria-busy="true"] p-skeleton')).toBeTruthy();
      expect(fixture.nativeElement.textContent).not.toContain('No accounts yet');
    });

    it('should show the net worth card and groups when there are accounts', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true)]);

      // assert & verify
      expect(fixture.nativeElement.querySelector('app-account-overview')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-account-list')).toBeTruthy();
    });
  });

  describe('review fixes', () => {
    const dirtyEditForm = (): void => {
      fixture.detectChanges();
      const form = fixture.debugElement.query(By.directive(AccountEditFormComponent))
        .componentInstance as AccountEditFormComponent;
      form.form.markAsDirty();
    };
    const createReq = {
      name: 'ZZ',
      type: 'CHECKING',
      startingBalance: 0,
      currencyCode: 'USD',
      bankName: null,
    };

    it('should send only one create request while the first is still in flight', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true)]);
      component.startCreate();
      mockAccountApi.create.mockReturnValue(new Subject<number>());

      // act
      component.onSave(createReq);
      component.onSave(createReq);

      // assert & verify
      expect(mockAccountApi.create).toHaveBeenCalledTimes(1);
      expect(component.saving()).toBe(true);
    });

    it('should send only one update while the first is in flight, and allow a retry after it fails', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true)]);
      component.startEdit(component.accounts()[0]);
      const pending = new Subject<number>();
      mockAccountApi.update.mockReturnValue(pending);
      const req = {
        id: 1,
        name: 'x',
        type: 'CHECKING',
        currencyCode: 'USD',
        bankName: null,
        version: 1,
      };

      // act
      component.onSave(req);
      component.onSave(req);
      pending.error({ error: { detail: 'conflict' } });

      // assert & verify
      expect(mockAccountApi.update).toHaveBeenCalledTimes(1);
      expect(component.saving()).toBe(false);
    });

    it('should ask before View transactions leaves a dirty edit, and navigate only on Discard', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true), acct(2, 'B', 2, true)]);
      component.startEdit(component.accounts()[0]);
      dirtyEditForm();

      // act
      component.viewTransactions(component.accounts()[1]);

      // assert & verify
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      mockConfirmationService.confirm.mock.calls[0][0].accept!();
      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
    });

    it('should not ask or reset when Edit, Reconcile or Add is chosen for what is already open', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true)]);
      component.startEdit(component.accounts()[0]);
      dirtyEditForm();

      // act
      component.startEdit(component.accounts()[0]);
      component.startEdit();

      // assert & verify
      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
      expect(component.panelMode()).toBe('edit');

      // act
      component.startCreate();
      mockConfirmationService.confirm.mock.calls[0][0].accept!();
      fixture.detectChanges();
      mockConfirmationService.confirm.mockClear();
      component.startCreate();

      // assert & verify
      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
      expect(component.panelMode()).toBe('create');
    });

    it('should close the panel and say so when the shown account is gone after a reload', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true), acct(2, 'B', 2, true)]);
      component.startReconcile(component.accounts()[1]);

      // act
      loadWith([acct(1, 'A', 1, true)]);

      // assert & verify
      expect(component.panelMode()).toBe('overview');
      expect(component.selectedId()).toBeNull();
      expect(mockToast.error).toHaveBeenCalledWith('That account no longer exists.');
    });

    it('should keep the add panel open across a reload', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true)]);
      component.startCreate();

      // act
      loadWith([acct(1, 'A', 1, true)]);

      // assert & verify
      expect(component.panelMode()).toBe('create');
    });
  });

  describe('persistent panel modes', () => {
    it('should start in overview with nothing selected and nothing highlighted', () => {
      // assert & verify
      expect(component.panelMode()).toBe('overview');
      expect(component.selectedId()).toBeNull();
      expect(component.highlightedId()).toBeNull();
      expect(component.panelTitle()).toBe('Overview');
    });

    it('should highlight the account in account, edit and reconcile modes but not in create', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true), acct(2, 'B', 2, true)]);

      // act and assert & verify
      component.openAccount(component.accounts()[1]);
      expect(component.highlightedId()).toBe(2);
      component.startEdit();
      expect(component.highlightedId()).toBe(2);
      component.startReconcile();
      expect(component.highlightedId()).toBe(2);
      component.startCreate();
      expect(component.highlightedId()).toBeNull();
    });

    it('should go Back from account to overview, and from edit and reconcile to account', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true)]);
      component.openAccount(component.accounts()[0]);

      // act and assert & verify
      component.startEdit();
      component.back();
      expect(component.panelMode()).toBe('account');
      component.startReconcile();
      component.back();
      expect(component.panelMode()).toBe('account');
      component.back();
      expect(component.panelMode()).toBe('overview');
      expect(component.selectedId()).toBeNull();
    });

    it('should send Close and Escape from account, edit and reconcile to overview', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true)]);

      // act and assert & verify
      for (const open of [
        (): void => component.openAccount(component.accounts()[0]),
        (): void => component.startEdit(component.accounts()[0]),
        (): void => component.startReconcile(component.accounts()[0]),
      ]) {
        open();
        component.onPanelClose();
        expect(component.panelMode()).toBe('overview');
        expect(component.selectedId()).toBeNull();
      }
    });

    it('should do nothing on Close or Escape in overview', () => {
      // act
      component.onPanelClose();

      // assert & verify
      expect(component.panelMode()).toBe('overview');
      expect(component.showClose()).toBe(false);
    });

    it('should return from create to where the user came from', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true)]);

      // act and assert & verify -- from overview
      component.startCreate();
      expect(component.showBack()).toBe(true);
      component.back();
      expect(component.panelMode()).toBe('overview');

      // act and assert & verify -- from an account
      component.openAccount(component.accounts()[0]);
      component.startCreate();
      expect(component.selectedId()).toBe(1);
      component.back();
      expect(component.panelMode()).toBe('account');
    });

    it('should send Close and Escape from create to overview', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true)]);
      component.openAccount(component.accounts()[0]);
      component.startCreate();

      // act
      component.onPanelClose();

      // assert & verify
      expect(component.panelMode()).toBe('overview');
      expect(component.selectedId()).toBeNull();
    });

    it('should return to overview when the shown account is deleted', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true), acct(2, 'B', 2, true)]);
      component.openAccount(component.accounts()[0]);
      mockAccountApi.delete.mockReturnValue(of(undefined));

      // act
      component.deleteAccount(component.accounts()[0]);
      mockConfirmationService.confirm.mock.calls[0][0].accept!();

      // assert & verify
      expect(component.panelMode()).toBe('overview');
      expect(component.selectedId()).toBeNull();
    });
  });

  describe('no accounts', () => {
    it('should open create with no Back or Close when there are no accounts', () => {
      // act
      loadWith([]);

      // assert & verify
      expect(component.panelMode()).toBe('create');
      expect(component.onlyAddMode()).toBe(true);
      expect(component.showClose()).toBe(false);
      expect(component.showBack()).toBe(false);
    });

    it('should ignore Close and Escape while it is the only mode', () => {
      // arrange
      loadWith([]);

      // act
      component.onPanelClose();

      // assert & verify
      expect(component.panelMode()).toBe('create');
    });

    it('should open the new account after creating the first one, with Back and Close available', () => {
      // arrange
      loadWith([]);
      mockAccountApi.create.mockReturnValue(of(9));
      mockAccountApi.getAccounts.mockReturnValue(of([acct(9, 'First', 0, true)]));

      // act
      component.onSave({
        name: 'First',
        type: 'CHECKING',
        startingBalance: 0,
        currencyCode: 'USD',
        bankName: null,
      });

      // assert & verify
      expect(component.panelMode()).toBe('account');
      expect(component.selectedAccount()?.id).toBe(9);
      expect(component.showClose()).toBe(true);
      expect(component.onlyAddMode()).toBe(false);
    });

    it('should land in create, not overview, when the last account is deleted', () => {
      // arrange
      loadWith([acct(1, 'Only', 1, true)]);
      component.openAccount(component.accounts()[0]);
      mockAccountApi.delete.mockReturnValue(of(undefined));

      // act
      component.deleteAccount(component.accounts()[0]);
      mockConfirmationService.confirm.mock.calls[0][0].accept!();
      fixture.detectChanges();

      // assert & verify
      expect(component.panelMode()).toBe('create');
      expect(component.onlyAddMode()).toBe(true);
    });
  });

  describe('layout and states', () => {
    const aside = (): HTMLElement => fixture.nativeElement.querySelector('app-side-panel aside');
    const panelButton = (label: string): HTMLButtonElement | undefined =>
      Array.from<HTMLButtonElement>(
        fixture.nativeElement.querySelectorAll('app-side-panel button'),
      ).find((b) => b.textContent?.trim() === label);

    it('should always render the panel, showing the overview with the totals by default', () => {
      // arrange
      loadWith([acct(1, 'Checking', 1000, true), acct(2, 'Visa', -250, false)]);

      // assert & verify
      expect(aside().getAttribute('aria-label')).toBe('Overview');
      expect(fixture.nativeElement.querySelectorAll('app-account-overview').length).toBe(1);
      expect(
        fixture.nativeElement.querySelector('[data-testid="net-worth"]').textContent,
      ).toContain('$750.00');
    });

    it('should show the account view with a Back to overview link when a row is opened', () => {
      // arrange
      loadWith([acct(1, 'Checking', 100, true)]);

      // act
      component.openAccount(component.accounts()[0]);
      fixture.detectChanges();

      // assert & verify
      expect(aside().getAttribute('aria-label')).toBe('Checking');
      expect(panelButton('Back to overview')).toBeTruthy();
    });

    it('should show No accounts yet and the add form when there are no accounts', () => {
      // act
      loadWith([]);

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('No accounts yet');
      expect(fixture.nativeElement.querySelector('app-account-edit-form')).toBeTruthy();
      expect(aside().getAttribute('aria-label')).toBe('Add account');
    });

    it('should show the full skeleton on first load with no panel yet', () => {
      // arrange
      component.accounts.set([]);
      component.panelMode.set('overview');
      component.loading.set(true);

      // act
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.querySelector('[aria-busy="true"] p-skeleton')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-side-panel')).toBeNull();
    });

    it('should keep the panel mounted and skeleton its body while a just-created account loads', () => {
      // arrange
      loadWith([]);
      const panelBefore = fixture.nativeElement.querySelector('app-side-panel');
      component.selectedId.set(9);
      component.panelMode.set('account');
      component.loading.set(true);

      // act
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.querySelector('app-side-panel')).toBe(panelBefore);
      expect(fixture.nativeElement.querySelector('app-side-panel p-skeleton')).toBeTruthy();
    });

    it('should hide Close in overview and in the only-add mode, and show it elsewhere', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true)]);

      // assert & verify
      expect(panelButton('Close')).toBeUndefined();

      // act
      component.openAccount(component.accounts()[0]);
      fixture.detectChanges();

      // assert & verify
      expect(panelButton('Close')).toBeTruthy();

      // act
      loadWith([]);

      // assert & verify
      expect(panelButton('Close')).toBeUndefined();
    });

    it('should show the footer only in edit, reconcile and create', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true)]);

      // assert & verify
      expect(panelButton('Save changes')).toBeUndefined();

      // act
      component.openAccount(component.accounts()[0]);
      fixture.detectChanges();

      // assert & verify
      expect(panelButton('Save changes')).toBeUndefined();

      // act
      component.startEdit();
      fixture.detectChanges();

      // assert & verify
      expect(panelButton('Save changes')).toBeTruthy();
    });

    it('should not be a fixed sheet in overview, and be one in every other mode', () => {
      // arrange
      loadWith([acct(1, 'A', 1, true)]);

      // assert & verify
      expect(aside().className).not.toContain('fixed');

      // act
      component.openAccount(component.accounts()[0]);
      fixture.detectChanges();

      // assert & verify
      expect(aside().className).toContain('fixed');
    });
  });

  describe('focus', () => {
    const aside = (): HTMLElement => fixture.nativeElement.querySelector('app-side-panel aside');
    const rowButton = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('[data-testid="open-account"]');

    it('should not take focus on page load', async () => {
      // arrange
      loadWith([acct(1, 'A', 1, true)]);
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).not.toBe(aside());
    });

    it('should move focus into the panel when a row is opened and back to that row on return', async () => {
      // arrange
      loadWith([acct(1, 'A', 1, true)]);
      const row = rowButton();
      row.focus();

      // act
      component.openAccount(component.accounts()[0]);
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(aside());

      // act
      component.closePanel();
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(row);
    });

    it('should focus the panel instead when the element that opened it is gone', async () => {
      // arrange
      loadWith([acct(1, 'A', 1, true), acct(2, 'B', 2, true)]);
      rowButton().focus();
      component.openAccount(component.accounts()[0]);
      fixture.detectChanges();
      await fixture.whenStable();

      // act -- the opening row disappears, then the panel returns to overview
      loadWith([acct(2, 'B', 2, true)]);
      component.closePanel();
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(aside());
    });

    it('should move focus into the panel on step changes (edit)', async () => {
      // arrange
      loadWith([acct(1, 'A', 1, true)]);
      component.openAccount(component.accounts()[0]);
      fixture.detectChanges();
      await fixture.whenStable();
      (document.activeElement as HTMLElement).blur();

      // act
      component.startEdit();
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(aside());
    });
  });
});
