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
import { Router } from '@angular/router';
import {
  catchError,
  concat,
  debounceTime,
  distinctUntilChanged,
  finalize,
  forkJoin,
  map,
  Observable,
  of,
  Subject,
  Subscription,
  toArray,
} from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService } from 'primeng/api';

import { MerchantApiService } from './services/merchant-api.service';
import { TransactionApiService } from '@features/transactions/services/transaction-api.service';
import { AuthService } from '@core/auth/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { SidePanelComponent } from '@shared/components/side-panel/side-panel.component';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';
import { Merchant, MerchantDescriptionLink, TransactionDescription } from '@models/merchant.model';
import { PageResponse } from '@models/transaction.model';
import { MerchantListComponent } from './components/merchant-list/merchant-list.component';
import { MerchantOverviewComponent } from './components/merchant-overview/merchant-overview.component';
import {
  MerchantEditFormComponent,
  MerchantFormValue,
} from './components/merchant-edit-form/merchant-edit-form.component';
import { DescriptionPickerComponent } from './components/description-picker/description-picker.component';

/** What the docked panel is showing. */
export type MerchantPanelMode = 'overview' | 'merchant' | 'add' | 'picker';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

/**
 * The Merchants page: a searchable list of merchants beside an always-present panel. The panel
 * shows an overview by default, an editor (with linked descriptions) for the selected merchant, the
 * add form, or the picker for linking real transaction descriptions to a merchant.
 */
@Component({
  selector: 'app-merchants',
  standalone: true,
  imports: [
    ButtonModule,
    SelectModule,
    SkeletonModule,
    ScreenToolbarComponent,
    PageErrorStateComponent,
    SidePanelComponent,
    MerchantListComponent,
    MerchantOverviewComponent,
    MerchantEditFormComponent,
    DescriptionPickerComponent,
  ],
  templateUrl: './merchants.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantsComponent implements OnInit {
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly authService: AuthService = inject(AuthService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly injector: Injector = inject(Injector);

  readonly pageSize: number = PAGE_SIZE;

  /** The merchants on the current page. */
  readonly merchants: WritableSignal<Merchant[]> = signal([]);
  readonly totalRecords: WritableSignal<number> = signal(0);
  /** The zero-based page shown. */
  readonly page: WritableSignal<number> = signal(0);
  readonly searchTerm: WritableSignal<string> = signal('');
  /** The search the shown rows were loaded for; it lags {@link searchTerm} while a reload is pending. */
  readonly dataSearch: WritableSignal<string> = signal('');
  readonly loading: WritableSignal<boolean> = signal(false);
  readonly loadError: WritableSignal<boolean> = signal(false);
  /** True once a load has succeeded; later reloads dim the list instead of replacing the page. */
  readonly loadedOnce: WritableSignal<boolean> = signal(false);
  /** A save, add or delete is in flight. */
  readonly saving: WritableSignal<boolean> = signal(false);

  /** Transaction descriptions with no merchant link; null until first loaded. */
  readonly unlinkedCount: WritableSignal<number | null> = signal(null);
  readonly hasTransactions: WritableSignal<boolean> = signal(false);

  readonly mode: WritableSignal<MerchantPanelMode> = signal('overview');
  /** The merchant shown in the merchant mode (kept as an object: it may not be on this page). */
  readonly selected: WritableSignal<Merchant | null> = signal(null);
  readonly links: WritableSignal<MerchantDescriptionLink[]> = signal([]);

  readonly pickerTarget: WritableSignal<Merchant | null> = signal(null);
  readonly pickerRows: WritableSignal<TransactionDescription[]> = signal([]);
  readonly pickerTotal: WritableSignal<number> = signal(0);
  readonly pickerPage: WritableSignal<number> = signal(0);
  readonly pickerSearch: WritableSignal<string> = signal('');
  readonly pickerUnlinkedOnly: WritableSignal<boolean> = signal(true);
  readonly pickerLoading: WritableSignal<boolean> = signal(false);
  readonly pickerFailed: WritableSignal<string[]> = signal([]);
  readonly linking: WritableSignal<boolean> = signal(false);
  /** Merchants offered by the "Link to" choice when the picker opens from the overview. */
  readonly targetOptions: WritableSignal<Merchant[]> = signal([]);

  /** With no merchants the add form is the only useful mode, so it has no Back or Close. */
  readonly onlyAddMode: Signal<boolean> = computed(
    (): boolean => this.totalRecords() === 0 && !this.dataSearching() && this.mode() === 'add',
  );
  private readonly isEmpty: Signal<boolean> = computed(
    (): boolean =>
      this.loadedOnce() &&
      this.totalRecords() === 0 &&
      !this.dataSearching() &&
      !this.loading() &&
      !this.loadError(),
  );
  /** Whether the rows shown were loaded for a search (so an empty list means no matches, not no merchants). */
  readonly dataSearching: Signal<boolean> = computed((): boolean => this.dataSearch() !== '');

  readonly panelTitle: Signal<string> = computed((): string => {
    switch (this.mode()) {
      case 'add':
        return 'Add merchant';
      case 'merchant':
        return this.selected()?.name ?? 'Merchant';
      case 'picker':
        return 'Link descriptions';
      default:
        return 'Overview';
    }
  });

  private readonly panel = viewChild(SidePanelComponent);
  private readonly editForm = viewChild<MerchantEditFormComponent>('editForm');

  /** The element that had focus when the panel left the overview, to hand focus back to. */
  private focusReturn: HTMLElement | null = null;
  private loadSubscription: Subscription | null = null;
  private loadRun = 0;
  private linksSubscription: Subscription | null = null;
  private pickerSubscription: Subscription | null = null;
  private pickerRun = 0;
  private readonly searchInput$: Subject<string> = new Subject<string>();
  private readonly pickerSearch$: Subject<string> = new Subject<string>();

  constructor() {
    effect((): void => {
      if (this.isEmpty() && this.mode() !== 'add') {
        untracked((): void => this.mode.set('add'));
      }
    });
    this.searchInput$
      .pipe(debounceTime(DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((): void => {
        this.page.set(0);
        this.loadMerchants();
      });
    this.pickerSearch$
      .pipe(debounceTime(DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((): void => this.loadPickerRows(true));
  }

  ngOnInit(): void {
    this.loadMerchants();
    this.loadStats();
  }

  /** Loads the current page of merchants; a newer load replaces an older one. */
  loadMerchants(): void {
    this.loadSubscription?.unsubscribe();
    const run: number = ++this.loadRun;
    this.loading.set(true);
    this.loadError.set(false);
    const term: string = this.searchTerm().trim();
    this.loadSubscription = this.merchantApi
      .getMerchants(term || null, { page: this.page(), size: PAGE_SIZE })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => {
          if (run === this.loadRun) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (res: PageResponse<Merchant>): void => {
          this.merchants.set(res.content);
          this.totalRecords.set(res.page.totalElements);
          this.dataSearch.set(term);
          this.loadedOnce.set(true);
          this.refreshSelected();
        },
        error: (err: unknown): void => {
          console.error('Failed to load merchants:', err);
          this.toast.error('Failed to load merchants');
          this.merchants.set([]);
          this.totalRecords.set(0);
          this.dataSearch.set(term);
          this.loadError.set(true);
        },
      });
  }

  /** Loads the two figures the overview needs: unlinked descriptions, and whether any exist. */
  loadStats(): void {
    forkJoin({
      unlinked: this.transactionApi.getDescriptions({ page: 0, size: 1, unlinkedOnly: true }),
      any: this.transactionApi.getDescriptions({ page: 0, size: 1 }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ unlinked, any }): void => {
          this.unlinkedCount.set(unlinked.page.totalElements);
          this.hasTransactions.set(any.page.totalElements > 0);
        },
        error: (err: unknown): void => console.error('Failed to load description totals:', err),
      });
  }

  onSearchInput(term: string): void {
    this.searchTerm.set(term);
    this.searchInput$.next(term);
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.page.set(0);
    this.loadMerchants();
  }

  setPage(page: number): void {
    this.page.set(page);
    this.loadMerchants();
  }

  /** Shows a merchant in the panel and loads its linked descriptions. */
  openMerchant(merchant: Merchant): void {
    if (this.mode() === 'merchant' && this.selected()?.id === merchant.id) return;
    this.confirmDiscardIfDirty((): void => {
      this.selected.set(merchant);
      this.links.set([]);
      this.go('merchant');
      this.loadLinks(merchant.id);
    });
  }

  /** Opens the add form. */
  startAdd(): void {
    if (this.mode() === 'add') return;
    this.confirmDiscardIfDirty((): void => {
      this.selected.set(null);
      this.go('add');
    });
  }

  /** Back: the picker returns to its merchant, everything else to the overview. */
  back(): void {
    const mode: MerchantPanelMode = this.mode();
    if (mode === 'overview') return;
    this.confirmDiscardIfDirty((): void => {
      const target: Merchant | null = this.pickerTarget();
      if (mode === 'picker' && target && this.selected()?.id === target.id) {
        this.go('merchant');
      } else {
        this.closePanel();
      }
    });
  }

  /** Returns to the overview with nothing selected, without asking. */
  closePanel(moveFocus = true): void {
    this.selected.set(null);
    this.pickerTarget.set(null);
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

  /** Saves the form: an update when a merchant is open, otherwise a create. */
  saveMerchant(value: MerchantFormValue): void {
    if (this.saving() || this.loading()) return;
    const userId: number = this.authService.user()?.id ?? 0;
    this.saving.set(true);
    if (value.id !== undefined) {
      const id: number = value.id;
      this.merchantApi
        .updateMerchant({ ...value, id, userId })
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize((): void => this.saving.set(false)),
        )
        .subscribe({
          next: (): void => {
            this.toast.success('Merchant updated');
            this.editForm()?.form.markAsPristine();
            this.selected.update(
              (current: Merchant | null): Merchant | null =>
                current && { ...current, ...this.asMerchantFields(value) },
            );
            this.loadMerchants();
          },
          error: (error: HttpErrorResponse): void => this.failed(error, 'Failed to save merchant'),
        });
      return;
    }
    this.merchantApi
      .createMerchant({ ...value, userId })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (newId: number): void => {
          this.toast.success('Merchant added');
          // the user may have gone back while the save ran: only continue into the picker if the
          // add form is still what they are looking at
          if (this.mode() === 'add') {
            this.editForm()?.form.markAsPristine();
            const created: Merchant = {
              id: newId,
              userId,
              linkCount: 0,
              ...this.asMerchantFields(value),
            };
            this.selected.set(created);
            this.links.set([]);
            this.showPicker(created, true);
          }
          this.loadMerchants();
          this.loadStats();
        },
        error: (error: HttpErrorResponse): void => this.failed(error, 'Failed to save merchant'),
      });
  }

  /** Confirms, then deletes the selected merchant. */
  deleteMerchant(): void {
    const merchant: Merchant | null = this.selected();
    if (!merchant || this.saving() || this.loading()) return;
    this.confirmationService.confirm({
      header: 'Delete merchant?',
      message: `Delete the ${merchant.name} merchant? Transactions keep their history but lose this merchant, and its linked descriptions are removed.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        if (this.saving()) return;
        this.saving.set(true);
        this.merchantApi
          .deleteMerchant(merchant.id)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize((): void => this.saving.set(false)),
          )
          .subscribe({
            next: (): void => {
              this.toast.success('Merchant deleted');
              this.closePanel();
              // deleting the only row on a later page leaves that page empty: step back one
              if (this.merchants().length === 1 && this.page() > 0) this.page.update((p) => p - 1);
              this.loadMerchants();
              this.loadStats();
            },
            error: (error: HttpErrorResponse): void =>
              this.failed(error, 'Failed to delete merchant'),
          });
      },
    });
  }

  /** Removes one linked description at once; it only affects future matching. */
  removeLink(link: MerchantDescriptionLink): void {
    const merchant: Merchant | null = this.selected();
    if (!merchant || this.saving()) return;
    this.saving.set(true);
    this.merchantApi
      .deleteDescriptionLink(merchant.id, link.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (): void => {
          this.toast.success('Link removed');
          this.loadLinks(merchant.id);
          this.loadMerchants();
          this.loadStats();
        },
        error: (error: HttpErrorResponse): void => this.failed(error, 'Failed to remove link'),
      });
  }

  /** Opens Transactions for the selected merchant across all time. */
  viewTransactions(): void {
    const merchant: Merchant | null = this.selected();
    if (!merchant) return;
    this.confirmDiscardIfDirty((): void => {
      void this.router.navigate(['/transactions'], {
        queryParams: { merchant: merchant.name, period: 'all' },
      });
    });
  }

  /** Opens the picker. From the overview there is no target yet and the user chooses one. */
  openPicker(target: Merchant | null = null, unlinkedOnly = true): void {
    this.confirmDiscardIfDirty((): void => this.showPicker(target, unlinkedOnly));
  }

  /** Picks the merchant to link to (overview flow) and loads the descriptions. */
  chooseTarget(merchant: Merchant): void {
    this.pickerTarget.set(merchant);
    this.loadPickerRows(true);
  }

  /** Narrows the "Link to" choice by name. */
  onTargetFilter(term: string): void {
    this.merchantApi
      .getMerchants(term.trim() || null, { page: 0, size: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res: PageResponse<Merchant>): void => this.targetOptions.set(res.content));
  }

  onPickerSearch(term: string): void {
    this.pickerSearch.set(term);
    this.pickerSearch$.next(term);
  }

  onPickerToggle(unlinkedOnly: boolean): void {
    this.pickerUnlinkedOnly.set(unlinkedOnly);
    this.loadPickerRows(true);
  }

  onPickerShowMore(): void {
    if (this.pickerLoading() || this.pickerRows().length >= this.pickerTotal()) return;
    this.loadPickerRows(false);
  }

  /**
   * Links the ticked descriptions to the target one at a time. One failure never stops the rest;
   * failed ones stay ticked in the picker and the toast names the counts and the first message.
   */
  onLink(descriptions: string[]): void {
    const target: Merchant | null = this.pickerTarget();
    if (!target || this.linking() || descriptions.length === 0) return;
    this.linking.set(true);
    this.pickerFailed.set([]);

    const linkOne = (
      description: string,
    ): Observable<{ description: string; ok: boolean; message: string }> =>
      this.merchantApi.addDescriptionLink(target.id, description).pipe(
        map(() => ({ description, ok: true, message: '' })),
        catchError((error: HttpErrorResponse) =>
          of({
            description,
            ok: false,
            message: error.error?.detail || 'Failed to link description',
          }),
        ),
      );

    concat(...descriptions.map(linkOne))
      .pipe(
        toArray(),
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.linking.set(false)),
      )
      .subscribe((results): void => {
        const linked: number = results.filter((r): boolean => r.ok).length;
        const failed = results.filter((r): boolean => !r.ok);
        this.loadMerchants();
        this.loadStats();
        // the batch can finish after the user has left this picker (it runs one request at a time)
        const stillHere: boolean =
          this.mode() === 'picker' && this.pickerTarget()?.id === target.id;
        if (failed.length === 0) {
          this.toast.success(`Linked ${linked} ${linked === 1 ? 'description' : 'descriptions'}`);
          if (stillHere) {
            this.selected.set(target);
            this.go('merchant');
            this.loadLinks(target.id);
          } else if (this.selected()?.id === target.id) {
            this.loadLinks(target.id);
          }
          return;
        }
        this.toast.error(`Linked ${linked}, ${failed.length} failed: ${failed[0].message}`);
        if (stillHere) {
          this.pickerFailed.set(failed.map((r): string => r.description));
          this.loadPickerRows(true);
        }
        if (this.selected()?.id === target.id) this.loadLinks(target.id);
      });
  }

  private showPicker(target: Merchant | null, unlinkedOnly: boolean): void {
    this.pickerTarget.set(target);
    this.pickerUnlinkedOnly.set(unlinkedOnly);
    this.pickerSearch.set('');
    this.pickerFailed.set([]);
    this.pickerRows.set([]);
    this.pickerTotal.set(0);
    this.pickerPage.set(0);
    this.targetOptions.set(this.merchants());
    this.go('picker');
    if (target) this.loadPickerRows(true);
  }

  private loadPickerRows(reset: boolean): void {
    this.pickerSubscription?.unsubscribe();
    const run: number = ++this.pickerRun;
    const page: number = reset ? 0 : this.pickerPage() + 1;
    this.pickerLoading.set(true);
    this.pickerSubscription = this.transactionApi
      .getDescriptions({
        search: this.pickerSearch(),
        unlinkedOnly: this.pickerUnlinkedOnly(),
        page,
        size: PAGE_SIZE,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => {
          if (run === this.pickerRun) this.pickerLoading.set(false);
        }),
      )
      .subscribe({
        next: (res: PageResponse<TransactionDescription>): void => {
          this.pickerRows.set(reset ? res.content : [...this.pickerRows(), ...res.content]);
          this.pickerTotal.set(res.page.totalElements);
          this.pickerPage.set(page);
        },
        error: (err: unknown): void => {
          console.error('Failed to load descriptions:', err);
          this.toast.error('Failed to load descriptions');
        },
      });
  }

  /** Loads a merchant's linked descriptions; a merchant that is gone sends the panel to the overview. */
  private loadLinks(merchantId: number): void {
    this.linksSubscription?.unsubscribe();
    this.linksSubscription = this.merchantApi
      .getDescriptionLinks(merchantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (links: MerchantDescriptionLink[]): void => this.links.set(links),
        error: (error: HttpErrorResponse): void => {
          if (error.status === 404 && this.selected()?.id === merchantId) {
            this.closePanel();
            this.toast.error('That merchant no longer exists.');
            this.loadMerchants();
            return;
          }
          this.toast.error('Failed to load linked descriptions');
        },
      });
  }

  /** Keeps the shown merchant in step with a freshly loaded page (counts, location). */
  private refreshSelected(): void {
    const current: Merchant | null = this.selected();
    if (!current) return;
    const fresh: Merchant | undefined = this.merchants().find(
      (m: Merchant): boolean => m.id === current.id,
    );
    if (fresh) this.selected.set(fresh);
  }

  private asMerchantFields(
    value: MerchantFormValue,
  ): Pick<Merchant, 'name' | 'city' | 'state' | 'postalCode' | 'country'> {
    return {
      name: value.name,
      city: value.city ?? null,
      state: value.state ?? null,
      postalCode: value.postalCode ?? null,
      country: value.country ?? null,
    };
  }

  private failed(error: HttpErrorResponse, fallback: string): void {
    console.error(fallback, error);
    this.toast.error(error.error?.detail || fallback);
  }

  /** Switches mode and moves focus: into the panel for any step, back to the opener for overview. */
  private go(mode: MerchantPanelMode, moveFocus = true): void {
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
    const mode: MerchantPanelMode = this.mode();
    const dirty: boolean = (mode === 'merchant' || mode === 'add') && !!this.editForm()?.form.dirty;
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
