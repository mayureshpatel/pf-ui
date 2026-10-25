import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  OnInit,
  Signal,
  signal,
  untracked,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, map, Observable, of, Subscription, switchMap, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService } from 'primeng/api';

import {
  DismissedPattern,
  RecurringSuggestion,
  RecurringTransaction,
} from '@models/recurring.model';
import { Account } from '@models/account.model';
import { Merchant } from '@models/merchant.model';
import { PageResponse } from '@models/transaction.model';
import { RecurringApiService } from './services/recurring-api.service';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { MerchantApiService } from '@features/merchants/services/merchant-api.service';
import { AuthService } from '@core/auth/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { SidePanelComponent } from '@shared/components/side-panel/side-panel.component';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';
import { RecurringListComponent } from './components/recurring-list/recurring-list.component';
import { RecurringOverviewComponent } from './components/recurring-overview/recurring-overview.component';
import {
  RecurringEditFormComponent,
  RecurringFormValue,
} from './components/recurring-edit-form/recurring-edit-form.component';
import {
  PatternAcceptance,
  PatternReviewComponent,
} from './components/pattern-review/pattern-review.component';
import {
  comingUp,
  groupByFrequency,
  RecurringGroup,
  RecurringTotals,
  totals,
} from './utils/recurring-helpers';

/** What the docked panel is showing. */
export type RecurringPanelMode = 'overview' | 'item' | 'add' | 'review' | 'review-form';

const MERCHANT_PAGE_SIZE = 20;

/**
 * The Recurring page: the tracked items grouped by how often they are paid, beside an always-present
 * panel. The panel shows an overview by default, an editor for the selected item, the add form, or
 * the review of detected patterns (a list, then a prefilled form to confirm one).
 */
@Component({
  selector: 'app-recurring',
  standalone: true,
  imports: [
    ButtonModule,
    SkeletonModule,
    ScreenToolbarComponent,
    PageErrorStateComponent,
    SidePanelComponent,
    RecurringListComponent,
    RecurringOverviewComponent,
    RecurringEditFormComponent,
    PatternReviewComponent,
  ],
  templateUrl: './recurring.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringComponent implements OnInit {
  private readonly recurringApi: RecurringApiService = inject(RecurringApiService);
  private readonly accountApi: AccountApiService = inject(AccountApiService);
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly authService: AuthService = inject(AuthService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly injector: Injector = inject(Injector);

  readonly items: WritableSignal<RecurringTransaction[]> = signal([]);
  readonly patterns: WritableSignal<RecurringSuggestion[]> = signal([]);
  readonly dismissed: WritableSignal<DismissedPattern[]> = signal([]);
  readonly accounts: WritableSignal<Account[]> = signal([]);
  readonly merchants: WritableSignal<Merchant[]> = signal([]);

  readonly loading: WritableSignal<boolean> = signal(false);
  readonly loadError: WritableSignal<boolean> = signal(false);
  /** True once a load has succeeded; later reloads dim the list instead of replacing the page. */
  readonly loadedOnce: WritableSignal<boolean> = signal(false);
  /** A save, add, accept, dismiss or delete is in flight. */
  readonly saving: WritableSignal<boolean> = signal(false);
  readonly patternsLoaded: WritableSignal<boolean> = signal(false);
  readonly patternsError: WritableSignal<boolean> = signal(false);

  readonly mode: WritableSignal<RecurringPanelMode> = signal('overview');
  readonly selected: WritableSignal<RecurringTransaction | null> = signal(null);
  readonly selectedPattern: WritableSignal<RecurringSuggestion | null> = signal(null);

  readonly groups: Signal<RecurringGroup[]> = computed((): RecurringGroup[] =>
    groupByFrequency(this.items()),
  );
  readonly totals: Signal<RecurringTotals> = computed((): RecurringTotals => totals(this.items()));
  readonly comingUp: Signal<RecurringTransaction[]> = computed((): RecurringTransaction[] =>
    comingUp(this.items()),
  );
  readonly priceChanges: Signal<RecurringTransaction[]> = computed((): RecurringTransaction[] =>
    this.items().filter((i: RecurringTransaction): boolean => i.active && !!i.priceChange),
  );

  /** Nothing tracked and nothing to review: the add form is the only useful mode. */
  private readonly isEmpty: Signal<boolean> = computed(
    (): boolean =>
      this.loadedOnce() &&
      this.items().length === 0 &&
      !this.loading() &&
      !this.loadError() &&
      this.patternsLoaded() &&
      this.patterns().length === 0,
  );
  readonly onlyAddMode: Signal<boolean> = computed(
    (): boolean =>
      this.loadedOnce() &&
      this.items().length === 0 &&
      this.patterns().length === 0 &&
      this.mode() === 'add',
  );

  readonly panelTitle: Signal<string> = computed((): string => {
    switch (this.mode()) {
      case 'add':
        return 'Add recurring';
      case 'item':
        return this.selected()?.merchant?.name ?? 'Recurring item';
      case 'review':
        return 'Patterns found';
      case 'review-form':
        return this.selectedPattern()?.merchant?.name ?? 'Pattern';
      default:
        return 'Overview';
    }
  });

  private readonly panel = viewChild(SidePanelComponent);
  private readonly editForm = viewChild<RecurringEditFormComponent>('editForm');
  private readonly reviewForm = viewChild<PatternReviewComponent>('review');

  /** The element that had focus when the panel left the overview, to hand focus back to. */
  private focusReturn: HTMLElement | null = null;
  private loadSubscription: Subscription | null = null;
  private loadRun = 0;
  private patternsSubscription: Subscription | null = null;
  private merchantSubscription: Subscription | null = null;
  /** An item just created: select it and open it once the reloaded list contains it. */
  private pendingSelectId: number | null = null;
  /** Merchants created for a pattern whose accept failed later, so a retry does not create another. */
  private readonly createdMerchants: Map<string, number> = new Map<string, number>();

  constructor() {
    effect((): void => {
      if (this.isEmpty() && this.mode() === 'overview') {
        untracked((): void => this.mode.set('add'));
      }
    });
  }

  ngOnInit(): void {
    this.loadItems();
    this.loadPatterns();
    this.loadAccounts();
    this.loadMerchantOptions(null);
  }

  /** Loads the tracked items; a newer load replaces an older one. */
  loadItems(): void {
    this.loadSubscription?.unsubscribe();
    const run: number = ++this.loadRun;
    this.loading.set(true);
    this.loadError.set(false);
    this.loadSubscription = this.recurringApi
      .getAll()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => {
          if (run === this.loadRun) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (data: RecurringTransaction[]): void => {
          this.items.set(data);
          this.loadedOnce.set(true);
          this.afterItemsLoaded();
        },
        error: (err: unknown): void => {
          console.error('Failed to load recurring data:', err);
          this.toast.error('Failed to load recurring items');
          this.items.set([]);
          this.loadError.set(true);
        },
      });
  }

  /** Loads the detected patterns and the dismissed ones. A failure only affects the strip and the review. */
  loadPatterns(): void {
    this.patternsSubscription?.unsubscribe();
    this.patternsSubscription = forkJoin({
      patterns: this.recurringApi.getSuggestions(),
      dismissed: this.recurringApi.getDismissed(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ patterns, dismissed }): void => {
          this.patterns.set(patterns);
          this.dismissed.set(dismissed);
          this.patternsError.set(false);
          this.patternsLoaded.set(true);
        },
        error: (err: unknown): void => {
          console.error('Failed to load recurring patterns:', err);
          this.patterns.set([]);
          this.dismissed.set([]);
          this.patternsError.set(true);
          this.patternsLoaded.set(true);
        },
      });
  }

  private loadAccounts(): void {
    this.accountApi
      .getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: Account[]): void => this.accounts.set(data),
        error: (err: unknown): void => {
          console.error('Failed to load accounts for selection:', err);
          this.toast.error('Failed to load accounts');
        },
      });
  }

  private loadMerchantOptions(term: string | null, then?: () => void): void {
    this.merchantSubscription?.unsubscribe();
    this.merchantSubscription = this.merchantApi
      .getMerchants(term, { page: 0, size: MERCHANT_PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: PageResponse<Merchant>): void => {
          this.merchants.set(res.content);
          then?.();
        },
        error: (err: unknown): void => {
          console.error('Failed to load merchants for selection:', err);
          then?.();
        },
      });
  }

  /** Narrows the merchant choice as the user types in a merchant search. */
  onMerchantFilter(term: string): void {
    this.loadMerchantOptions(term.trim() || null);
  }

  /** Shows an item in the panel. */
  openItem(item: RecurringTransaction): void {
    if (this.mode() === 'item' && this.selected()?.id === item.id) return;
    this.confirmDiscardIfDirty((): void => {
      this.selected.set(item);
      this.selectedPattern.set(null);
      this.go('item');
    });
  }

  /** Opens the add form. */
  startAdd(): void {
    if (this.mode() === 'add') return;
    this.confirmDiscardIfDirty((): void => {
      this.selected.set(null);
      this.selectedPattern.set(null);
      this.go('add');
    });
  }

  /** Opens the review of detected patterns. */
  openReview(): void {
    if (this.mode() === 'review' || this.mode() === 'review-form') return;
    this.confirmDiscardIfDirty((): void => {
      this.selected.set(null);
      this.selectedPattern.set(null);
      this.go('review');
      if (!this.patternsLoaded()) this.loadPatterns();
    });
  }

  /**
   * Opens the review form for a pattern. The merchants matching the detected name are loaded first so
   * the form can preselect an existing merchant instead of proposing a duplicate.
   */
  choosePattern(pattern: RecurringSuggestion): void {
    this.loadMerchantOptions(pattern.merchant.name.trim() || null, (): void => {
      if (this.mode() !== 'review' && this.mode() !== 'review-form') return;
      this.selectedPattern.set(pattern);
      this.go('review-form');
    });
  }

  /** Back: the review form returns to the pattern list, the list to the overview, the rest to the overview. */
  back(): void {
    const mode: RecurringPanelMode = this.mode();
    if (mode === 'overview') return;
    this.confirmDiscardIfDirty((): void => {
      if (mode === 'review-form') {
        this.selectedPattern.set(null);
        this.go('review');
      } else {
        this.closePanel();
      }
    });
  }

  /** Returns to the overview with nothing selected, without asking. */
  closePanel(moveFocus = true): void {
    this.selected.set(null);
    this.selectedPattern.set(null);
    this.go('overview', moveFocus);
  }

  /** Close button and Escape: asks first when there are unsaved edits; the overview ignores them. */
  onPanelClose(): void {
    if (this.mode() === 'overview' || this.onlyAddMode()) return;
    this.confirmDiscardIfDirty((): void => this.closePanel());
  }

  /** The panel's Save button: submits the form that is showing. */
  onPanelSave(): void {
    this.editForm()?.submit();
  }

  /** Saves the item form: an update when an item is open, otherwise a create. */
  saveItem(value: RecurringFormValue): void {
    if (this.saving()) return;
    this.saving.set(true);
    if (value.id !== undefined) {
      const id: number = value.id;
      this.recurringApi
        .update({
          id,
          merchantId: value.merchantId,
          accountId: value.accountId,
          amount: value.amount,
          frequency: value.frequency,
          nextDate: value.nextDate,
          active: value.active,
        })
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize((): void => this.saving.set(false)),
        )
        .subscribe({
          next: (): void => {
            this.toast.success('Recurring item updated');
            this.editForm()?.form.markAsPristine();
            this.loadItems();
          },
          error: (error: HttpErrorResponse): void => this.failed(error, 'Failed to save item'),
        });
      return;
    }
    this.recurringApi
      .create({ userId: this.userId(), ...value })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (newId: number): void => {
          this.toast.success('Recurring item added');
          if (this.mode() === 'add') {
            this.editForm()?.form.markAsPristine();
            this.pendingSelectId = newId;
          }
          this.loadItems();
        },
        error: (error: HttpErrorResponse): void => this.failed(error, 'Failed to add item'),
      });
  }

  /** Sets the stored amount to what the real charges now cost. */
  updatePrice(): void {
    const item: RecurringTransaction | null = this.selected();
    const change = item?.priceChange;
    if (!item || !change) return;
    this.sendUpdate(item, { amount: change.newAmount }, 'Price updated');
  }

  /** Pauses an active item or resumes a paused one. */
  togglePaused(): void {
    const item: RecurringTransaction | null = this.selected();
    if (!item) return;
    this.sendUpdate(item, { active: !item.active }, item.active ? 'Paused' : 'Resumed');
  }

  private sendUpdate(
    item: RecurringTransaction,
    patch: Partial<{ amount: number; active: boolean }>,
    message: string,
  ): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.recurringApi
      .update({
        id: item.id,
        merchantId: item.merchant.id,
        accountId: item.account.id,
        amount: item.amount,
        frequency: item.frequency,
        nextDate: item.nextDate,
        active: item.active,
        ...patch,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (): void => {
          this.toast.success(message);
          this.loadItems();
        },
        error: (error: HttpErrorResponse): void => this.failed(error, 'Failed to save item'),
      });
  }

  /** Confirms, then deletes the selected item. */
  deleteItem(): void {
    const item: RecurringTransaction | null = this.selected();
    if (!item || this.saving()) return;
    this.confirmationService.confirm({
      header: 'Delete recurring item?',
      message: `Stop tracking ${item.merchant.name}? Your past transactions are not affected.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        if (this.saving()) return;
        this.saving.set(true);
        this.recurringApi
          .delete(item.id)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize((): void => this.saving.set(false)),
          )
          .subscribe({
            next: (): void => {
              this.toast.success('Recurring item deleted');
              this.closePanel();
              this.loadItems();
            },
            error: (error: HttpErrorResponse): void => this.failed(error, 'Failed to delete item'),
          });
      },
    });
  }

  /**
   * Accepts a detected pattern: create the merchant when asked, link the detected description to it
   * (so later charges match), then create the item. The merchant is remembered per pattern so a retry
   * after a later step fails does not create it twice.
   */
  acceptPattern(acceptance: PatternAcceptance): void {
    if (this.saving()) return;
    this.saving.set(true);
    const key: string = acceptance.pattern.patternKey;
    this.merchantFor(acceptance, key)
      .pipe(
        switchMap((merchantId: number) =>
          this.merchantApi
            .addDescriptionLink(merchantId, acceptance.pattern.merchant.name)
            .pipe(map((): number => merchantId)),
        ),
        switchMap((merchantId: number) =>
          this.recurringApi.create({
            userId: this.userId(),
            merchantId,
            accountId: acceptance.accountId,
            amount: acceptance.amount,
            frequency: acceptance.frequency,
            nextDate: acceptance.nextDate,
            active: true,
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (): void => {
          this.toast.success('Added to recurring');
          this.createdMerchants.delete(key);
          this.patterns.update((list) => list.filter((p) => p.patternKey !== key));
          // the user may have gone back while it saved: only move the panel if they are still here
          if (this.mode() === 'review-form' && this.selectedPattern()?.patternKey === key) {
            this.selectedPattern.set(null);
            this.go('review');
          }
          this.loadItems();
        },
        error: (error: HttpErrorResponse): void => this.failed(error, 'Failed to add item'),
      });
  }

  private merchantFor(acceptance: PatternAcceptance, key: string): Observable<number> {
    if (acceptance.merchantId !== null) {
      return of(acceptance.merchantId);
    }
    const existing: number | undefined = this.createdMerchants.get(key);
    if (existing !== undefined) {
      return of(existing);
    }
    return this.merchantApi
      .createMerchant({ userId: this.userId(), name: acceptance.newMerchantName ?? '' })
      .pipe(tap((id: number): void => void this.createdMerchants.set(key, id)));
  }

  /** Dismisses a pattern so it stops being suggested; it can be restored from the dismissed list. */
  dismissPattern(pattern: RecurringSuggestion): void {
    if (this.saving()) return;
    this.saving.set(true);
    const key: string = pattern.patternKey;
    this.recurringApi
      .dismiss(key, pattern.merchant.name)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (id: number): void => {
          this.patterns.update((list) => list.filter((p) => p.patternKey !== key));
          this.dismissed.update((list) => [
            {
              id,
              patternKey: key,
              name: pattern.merchant.name,
              dismissedAt: new Date().toISOString(),
            },
            ...list,
          ]);
          this.toast.success('Dismissed');
          if (this.mode() === 'review-form' && this.selectedPattern()?.patternKey === key) {
            this.selectedPattern.set(null);
            this.go('review');
          }
        },
        error: (error: HttpErrorResponse): void => this.failed(error, 'Failed to dismiss pattern'),
      });
  }

  /** Restores a dismissed pattern and detects patterns again so it can come back. */
  restorePattern(entry: DismissedPattern): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.recurringApi
      .restore(entry.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (): void => {
          this.dismissed.update((list) => list.filter((d) => d.id !== entry.id));
          this.recurringApi
            .getSuggestions()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (patterns: RecurringSuggestion[]): void => this.patterns.set(patterns),
              error: (err: unknown): void => console.error('Failed to reload patterns:', err),
            });
        },
        error: (error: HttpErrorResponse): void => this.failed(error, 'Failed to restore pattern'),
      });
  }

  private userId(): number {
    return this.authService.user()?.id ?? 0;
  }

  /** After a reload: keep the shown item in step, open a just-created one, notice a vanished one. */
  private afterItemsLoaded(): void {
    if (this.pendingSelectId !== null) {
      const created: RecurringTransaction | undefined = this.items().find(
        (i: RecurringTransaction): boolean => i.id === this.pendingSelectId,
      );
      this.pendingSelectId = null;
      if (created && this.mode() === 'add') {
        this.selected.set(created);
        this.go('item');
        return;
      }
    }
    const current: RecurringTransaction | null = this.selected();
    if (!current || this.mode() !== 'item') return;
    const fresh: RecurringTransaction | undefined = this.items().find(
      (i: RecurringTransaction): boolean => i.id === current.id,
    );
    if (fresh) {
      this.selected.set(fresh);
    } else {
      this.closePanel();
      this.toast.error('That item no longer exists.');
    }
  }

  private failed(error: HttpErrorResponse, fallback: string): void {
    console.error(fallback, error);
    this.toast.error(error.error?.detail || fallback);
  }

  /** Switches mode and moves focus: into the panel for any step, back to the opener for overview. */
  private go(mode: RecurringPanelMode, moveFocus = true): void {
    if (!moveFocus) {
      this.focusReturn = null;
      this.mode.set(mode);
      return;
    }
    // already on the overview (a reload): nothing moved, so focus stays put
    if (mode === 'overview' && this.mode() === 'overview') return;
    if (this.mode() === 'overview' && mode !== 'overview') {
      this.focusReturn = document.activeElement as HTMLElement | null;
    }
    this.mode.set(mode);
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

  /** Runs an action that would replace a form, after asking when that form has unsaved changes. */
  private confirmDiscardIfDirty(proceed: () => void): void {
    const mode: RecurringPanelMode = this.mode();
    const dirty: boolean =
      ((mode === 'item' || mode === 'add') && !!this.editForm()?.form.dirty) ||
      (mode === 'review-form' && !!this.reviewForm()?.form.dirty);
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
