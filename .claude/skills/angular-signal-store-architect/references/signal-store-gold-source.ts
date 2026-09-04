import {computed, effect, inject, Injectable, signal, Signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {AccountApiService} from '@features/accounts/services/account-api.service';
import {Account} from '@models/account.model';

const SELECTED_ACCOUNT_STORAGE_KEY = 'pf.selectedAccountId';

/**
 * Holds account list state and derived aggregates for the accounts feature. Pure Signals-first:
 * the only RxJS touch-point is toSignal() wrapping the HttpClient-backed API call, which is the
 * one place angular-signal-store-architect's "No RxJS" mandate explicitly permits.
 */
@Injectable({
  providedIn: 'root',
})
export class AccountStateService {
  private readonly accountApi: AccountApiService = inject(AccountApiService);

  /**
   * The account list, sourced from the API. toSignal() is the boundary where an Observable
   * becomes a Signal -- everything downstream of this line is Signals only, no .pipe(), no
   * BehaviorSubject, no manual subscription/unsubscription to manage.
   */
  readonly accounts: Signal<Account[]> = toSignal(this.accountApi.getAccounts(), {
    initialValue: [],
  });

  /** Writable local UI state: which account is currently selected/expanded, if any. */
  readonly selectedAccountId = signal<number | null>(this.readStoredSelection());

  /** Derived state: the full Account object for the current selection, or undefined. */
  readonly selectedAccount = computed<Account | undefined>(() =>
    this.accounts().find((account) => account.id === this.selectedAccountId())
  );

  /** Derived state: total balance across every loaded account. */
  readonly totalBalance = computed<number>(() =>
    this.accounts().reduce((sum, account) => sum + account.currentBalance, 0)
  );

  constructor() {
    // effect() used sparingly, for exactly one side effect: keep the selection choice around
    // across page reloads. Not used for data fetching or anything computed() could express instead.
    effect(() => {
      const id = this.selectedAccountId();
      if (id === null) {
        localStorage.removeItem(SELECTED_ACCOUNT_STORAGE_KEY);
      } else {
        localStorage.setItem(SELECTED_ACCOUNT_STORAGE_KEY, String(id));
      }
    });
  }

  selectAccount(id: number | null): void {
    this.selectedAccountId.set(id);
  }

  private readStoredSelection(): number | null {
    const stored = localStorage.getItem(SELECTED_ACCOUNT_STORAGE_KEY);
    return stored === null ? null : Number(stored);
  }
}
