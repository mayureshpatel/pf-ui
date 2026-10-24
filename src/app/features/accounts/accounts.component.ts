import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  DestroyRef,
  inject,
  Injector,
  OnInit,
  Signal,
  signal,
  untracked,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService } from 'primeng/api';
import {
  Account,
  AccountCreateRequest,
  AccountType,
  AccountUpdateRequest,
} from '@models/account.model';
import { AccountApiService } from './services/account-api.service';
import { AccountOverviewComponent } from './components/account-overview/account-overview.component';
import { AccountListComponent } from './components/account-list/account-list.component';
import { AccountSummaryViewComponent } from './components/account-summary-view/account-summary-view.component';
import { AccountEditFormComponent } from './components/account-edit-form/account-edit-form.component';
import { AccountReconcileFormComponent } from './components/account-reconcile-form/account-reconcile-form.component';
import { SidePanelComponent } from '@shared/components/side-panel/side-panel.component';
import { AccountGroup, AccountTotals, accountTotals, groupAccounts } from './utils/account-totals';
import { ToastService } from '@core/services/toast.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { finalize, forkJoin } from 'rxjs';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [
    ButtonModule,
    SkeletonModule,
    ScreenToolbarComponent,
    PageErrorStateComponent,
    SidePanelComponent,
    AccountOverviewComponent,
    AccountListComponent,
    AccountSummaryViewComponent,
    AccountEditFormComponent,
    AccountReconcileFormComponent,
  ],
  templateUrl: './accounts.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsComponent implements OnInit {
  private readonly accountApi: AccountApiService = inject(AccountApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly router: Router = inject(Router);

  accounts: WritableSignal<Account[]> = signal([]);
  accountTypes: WritableSignal<AccountType[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  loadError: WritableSignal<boolean> = signal(false);
  /** A create or update request is in flight. */
  saving: WritableSignal<boolean> = signal(false);

  /** What the docked panel is showing. */
  panelMode: WritableSignal<PanelMode> = signal('overview');
  /** The account the panel is about (null in overview and when no account is chosen). */
  selectedId: WritableSignal<number | null> = signal(null);

  selectedAccount: Signal<Account | null> = computed(
    (): Account | null =>
      this.accounts().find((a: Account): boolean => a.id === this.selectedId()) ?? null,
  );
  totals: Signal<AccountTotals> = computed((): AccountTotals => accountTotals(this.accounts()));
  groups: Signal<AccountGroup[]> = computed((): AccountGroup[] => groupAccounts(this.accounts()));
  isEmpty: Signal<boolean> = computed(
    (): boolean => this.accounts().length === 0 && !this.loading() && !this.loadError(),
  );

  /** The row to highlight: only while the panel is about an account. */
  highlightedId: Signal<number | null> = computed((): number | null =>
    ['account', 'edit', 'reconcile'].includes(this.panelMode()) ? this.selectedId() : null,
  );

  /** With no accounts the add form is the only useful mode, so it has no Back or Close. */
  onlyAddMode: Signal<boolean> = computed(
    (): boolean => this.accounts().length === 0 && !this.loading() && this.panelMode() === 'create',
  );

  showClose: Signal<boolean> = computed(
    (): boolean => this.panelMode() !== 'overview' && !this.onlyAddMode(),
  );

  showBack: Signal<boolean> = computed(
    (): boolean => this.panelMode() !== 'overview' && !this.onlyAddMode(),
  );

  panelTitle: Signal<string> = computed((): string => {
    const name: string = this.selectedAccount()?.name ?? 'account';
    switch (this.panelMode()) {
      case 'overview':
        return 'Overview';
      case 'create':
        return 'Add account';
      case 'edit':
        return `Edit ${name}`;
      case 'reconcile':
        return `Reconcile ${name}`;
      default:
        return this.selectedAccount()?.name ?? 'Account';
    }
  });

  private readonly injector: Injector = inject(Injector);
  private readonly panel = viewChild(SidePanelComponent);

  /** The element that had focus when the panel left the overview, to hand focus back to. */
  private focusReturn: HTMLElement | null = null;

  private readonly editForm = viewChild<AccountEditFormComponent>('editForm');
  private readonly reconcileForm = viewChild<AccountReconcileFormComponent>('reconcileForm');

  constructor() {
    effect((): void => {
      if (this.isEmpty() && this.panelMode() !== 'create') {
        untracked((): void => this.panelMode.set('create'));
      }
    });
  }

  ngOnInit(): void {
    this.loadAccounts();
  }

  /** Loads accounts and account types from the API. */
  loadAccounts(): void {
    this.loading.set(true);
    this.loadError.set(false);

    forkJoin({
      accounts: this.accountApi.getAccounts(),
      accountTypes: this.accountApi.getAccountTypes(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false)),
      )
      .subscribe({
        next: ({ accounts, accountTypes }): void => {
          this.accounts.set(accounts);
          this.accountTypes.set(accountTypes);
          this.closePanelIfAccountGone(accounts);
        },
        error: (error: unknown): void => {
          console.error('Error loading accounts:', error);
          this.toast.error('Failed to load accounts');
          this.loadError.set(true);
        },
      });
  }

  /** Shows an account in the panel. */
  openAccount(account: Account): void {
    if (this.panelMode() === 'account' && this.selectedId() === account.id) return;
    this.confirmDiscardIfDirty((): void => {
      this.selectedId.set(account.id);
      this.go('account');
    });
  }

  /** Opens the Edit step, for the given account or the one already shown. */
  startEdit(account?: Account): void {
    if (this.panelMode() === 'edit' && (!account || account.id === this.selectedId())) return;
    this.confirmDiscardIfDirty((): void => {
      if (account) this.selectedId.set(account.id);
      this.go('edit');
    });
  }

  /** Opens the Reconcile step, for the given account or the one already shown. */
  startReconcile(account?: Account): void {
    if (this.panelMode() === 'reconcile' && (!account || account.id === this.selectedId())) return;
    this.confirmDiscardIfDirty((): void => {
      if (account) this.selectedId.set(account.id);
      this.go('reconcile');
    });
  }

  /** Opens the panel to add an account (the selected account, if any, is kept for Back). */
  startCreate(): void {
    if (this.panelMode() === 'create') return;
    this.confirmDiscardIfDirty((): void => this.go('create'));
  }

  /** Back: account to overview, edit and reconcile to account, create to where it came from. */
  back(): void {
    const mode: PanelMode = this.panelMode();
    if (mode === 'overview') return;
    this.confirmDiscardIfDirty((): void => {
      if (mode === 'account') {
        this.closePanel();
      } else if (mode === 'create' && this.selectedId() === null) {
        this.go('overview');
      } else {
        this.go('account');
      }
    });
  }

  /** Returns to the overview with nothing selected, without asking. */
  closePanel(): void {
    this.selectedId.set(null);
    this.go('overview');
  }

  /** Close button and Escape: asks first when there are unsaved edits; the overview ignores them. */
  onPanelClose(): void {
    if (this.panelMode() === 'overview' || this.onlyAddMode()) return;
    this.confirmDiscardIfDirty((): void => this.closePanel());
  }

  /** Opens the Transactions page filtered to one account, across all time. */
  viewTransactions(account: Account): void {
    this.confirmDiscardIfDirty((): void => {
      void this.router.navigate(['/transactions'], {
        queryParams: { accountId: account.id, period: 'all' },
      });
    });
  }

  /** Switches mode and moves focus: into the panel for any step, back to the opener for overview. */
  private go(mode: PanelMode): void {
    if (this.panelMode() === 'overview' && mode !== 'overview') {
      this.focusReturn = document.activeElement as HTMLElement | null;
    }
    this.panelMode.set(mode);
    afterNextRender(
      (): void => {
        const target: HTMLElement | null = this.focusReturn;
        if (mode === 'overview' && target?.isConnected) {
          target.focus();
        } else {
          this.panel()?.focus();
        }
        if (mode === 'overview') this.focusReturn = null;
      },
      { injector: this.injector },
    );
  }

  /** The panel's Save button: submits whichever form is showing. */
  onPanelSave(): void {
    if (this.panelMode() === 'reconcile') {
      this.reconcileForm()?.submit();
    } else {
      this.editForm()?.submit();
    }
  }

  onSave(formData: AccountCreateRequest | AccountUpdateRequest): void {
    if (this.panelMode() === 'create') {
      this.createAccount(formData as AccountCreateRequest);
    } else {
      this.editAccount(formData as AccountUpdateRequest);
    }
  }

  onReconciled(_event: { adjustment: number }): void {
    this.go('account');
    this.loadAccounts();
  }

  onReloadRequested(): void {
    this.loadAccounts();
  }

  private createAccount(data: AccountCreateRequest): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.accountApi
      .create(data)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (newId: number): void => {
          this.toast.success('Account created successfully');
          this.editForm()?.form.markAsPristine();
          this.selectedId.set(newId);
          this.go('account');
          this.loadAccounts();
        },
        error: (error: HttpErrorResponse): void => {
          console.error('Error creating account:', error);
          this.toast.error(error.error?.detail || 'Failed to create account');
        },
      });
  }

  private editAccount(data: AccountUpdateRequest): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.accountApi
      .update(data)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (): void => {
          this.toast.success('Account updated successfully');
          this.editForm()?.form.markAsPristine();
          this.go('account');
          this.loadAccounts();
        },
        error: (error: HttpErrorResponse): void => {
          console.error('Error updating account:', error);
          this.toast.error(error.error?.detail || 'Failed to update account');
        },
      });
  }

  /** Confirms, then deletes an account; closes the panel if it was showing that account. */
  deleteAccount(account: Account): void {
    this.confirmationService.confirm({
      header: `Delete ${account.name}?`,
      message: 'This permanently deletes the account and cannot be undone.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.accountApi
          .delete(account.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (): void => {
              this.accounts.set(
                this.accounts().filter((a: Account): boolean => a.id !== account.id),
              );
              this.toast.success('Account deleted successfully');
              if (this.selectedId() === account.id) {
                this.closePanel();
              }
            },
            error: (error: HttpErrorResponse): void => {
              console.error('Error deleting account:', error);
              this.toast.error(error.error?.detail || 'Failed to delete account');
            },
          });
      },
    });
  }

  /** A reload that no longer contains the shown account (deleted elsewhere) closes the panel. */
  private closePanelIfAccountGone(accounts: Account[]): void {
    const id: number | null = this.selectedId();
    if (id === null || this.panelMode() === 'create') return;
    if (accounts.some((a: Account): boolean => a.id === id)) return;
    this.closePanel();
    this.toast.error('That account no longer exists.');
  }

  /** Runs an action that would replace a form, after asking when that form has unsaved changes. */
  private confirmDiscardIfDirty(proceed: () => void): void {
    const mode: PanelMode = this.panelMode();
    const dirty: boolean =
      ((mode === 'edit' || mode === 'create') && !!this.editForm()?.form.dirty) ||
      (mode === 'reconcile' && !!this.reconcileForm()?.form.dirty);
    if (!dirty) {
      proceed();
      return;
    }
    this.confirmationService.confirm({
      header: 'Discard changes?',
      message: 'You have unsaved changes. Discard them?',
      acceptLabel: 'Discard',
      rejectLabel: 'Keep editing',
      acceptButtonStyleClass: 'p-button-danger',
      accept: proceed,
    });
  }
}

/** The docked panel's states. */
export type PanelMode = 'overview' | 'account' | 'edit' | 'reconcile' | 'create';
