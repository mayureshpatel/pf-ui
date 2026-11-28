import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
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
import { ActivatedRoute, Params, Router } from '@angular/router';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  finalize,
  forkJoin,
  Observable,
  of,
  Subject,
  Subscription,
  switchMap,
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
import {
  DescriptionGroup,
  DescriptionGroupPage,
  DescriptionLinkCheck,
  LookAlikeWarning,
  Merchant,
  MerchantDescriptionLink,
  TransactionDescription,
} from '@models/merchant.model';
import { PageResponse } from '@models/transaction.model';
import { MerchantListComponent } from './components/merchant-list/merchant-list.component';
import { MerchantOverviewComponent } from './components/merchant-overview/merchant-overview.component';
import {
  MerchantEditFormComponent,
  MerchantFormValue,
} from './components/merchant-edit-form/merchant-edit-form.component';
import { DescriptionPickerComponent } from './components/description-picker/description-picker.component';
import { LinkResultComponent } from './components/link-result/link-result.component';
import {
  LastLink,
  lastLinkOf,
  LinkOutcome,
  linkInBatches,
  UndoOutcome,
  undoLink,
} from './utils/link-helpers';
import {
  MERCHANT_TAB_PANEL_ID,
  MerchantTabsComponent,
  merchantTabId,
  MerchantView,
  viewFromParam,
} from './components/merchant-tabs/merchant-tabs.component';
import {
  CreateForGroup,
  RuleOffer,
  UnlinkedGroupsComponent,
} from './components/unlinked-groups/unlinked-groups.component';
import { RuleOfferComponent } from './components/rule-offer/rule-offer.component';
import { MerchantRulesComponent } from '@features/settings/merchant-rules/merchant-rules.component';
import { SettingsGuard } from '@features/settings/settings.guard';

/** Whether the selected merchant's linked descriptions are loading, loaded or failed to load. */
export type LinksState = 'loading' | 'loaded' | 'failed';

/** What the docked panel is showing. */
export type MerchantPanelMode = 'overview' | 'merchant' | 'add' | 'picker';

const PAGE_SIZE = 20;
/** The picker works through a long backlog, so it pages in bigger steps than the list. */
/** Groups per picker page; each carries its variants, so fewer than the old flat rows. */
const PICKER_PAGE_SIZE = 25;
const DEBOUNCE_MS = 300;

/**
 * The Merchants page, in three tabs kept in the URL (`?view=`): Merchants, a searchable list of
 * merchants; Unlinked, the descriptions not linked to a merchant yet, grouped so they can be linked
 * a group at a time; and Rules, the merchant rules. The first two sit beside an always-present
 * panel that shows an overview by default, an editor (with linked descriptions) for the selected
 * merchant, the add form, or the picker for linking real transaction descriptions to a merchant.
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
    LinkResultComponent,
    MerchantTabsComponent,
    UnlinkedGroupsComponent,
    MerchantRulesComponent,
    RuleOfferComponent,
  ],
  // the rules tab registers its unsaved-changes check here, as it does on the Settings page
  providers: [SettingsGuard],
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
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly rulesGuard: SettingsGuard = inject(SettingsGuard);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly injector: Injector = inject(Injector);

  readonly pageSize: number = PAGE_SIZE;
  readonly tabPanelId: string = MERCHANT_TAB_PANEL_ID;
  readonly tabId = merchantTabId;

  /** The tab shown, as named in the URL. */
  readonly view: WritableSignal<MerchantView> = signal(
    viewFromParam(this.route.snapshot.queryParams['view']),
  );

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
  /** The name the add form opens with, when it was opened from a search that found nothing. */
  readonly addPrefill: WritableSignal<string> = signal('');
  /** Where the selected merchant's linked descriptions are: loading, loaded or failed to load. */
  readonly linksState: WritableSignal<LinksState> = signal<LinksState>('loading');
  /** True once a load has succeeded; later reloads dim the list instead of replacing the page. */
  readonly loadedOnce: WritableSignal<boolean> = signal(false);
  /** A save, add or delete is in flight. */
  readonly saving: WritableSignal<boolean> = signal(false);

  /** Transaction descriptions with no merchant link; null until first loaded. */
  readonly unlinkedCount: WritableSignal<number | null> = signal(null);
  readonly hasTransactions: WritableSignal<boolean> = signal(false);
  /** The description totals could not be loaded. */
  readonly statsFailed: WritableSignal<boolean> = signal(false);
  /** Every merchant the user has, whatever the search shows; null until first loaded. */
  readonly merchantTotal: WritableSignal<number | null> = signal(null);

  readonly mode: WritableSignal<MerchantPanelMode> = signal('overview');
  /** The merchant shown in the merchant mode (kept as an object: it may not be on this page). */
  readonly selected: WritableSignal<Merchant | null> = signal(null);
  readonly links: WritableSignal<MerchantDescriptionLink[]> = signal([]);

  readonly pickerTarget: WritableSignal<Merchant | null> = signal(null);
  readonly pickerGroups: WritableSignal<DescriptionGroup[]> = signal([]);
  /** Look-alike warnings for the picker's pending link, shown in place of its Link button. */
  readonly pickerWarnings: WritableSignal<LookAlikeWarning[]> = signal([]);
  readonly pickerTotal: WritableSignal<number> = signal(0);
  readonly pickerPage: WritableSignal<number> = signal(0);
  readonly pickerSearch: WritableSignal<string> = signal('');
  readonly pickerUnlinkedOnly: WritableSignal<boolean> = signal(true);
  readonly pickerLoading: WritableSignal<boolean> = signal(false);
  readonly pickerLoadFailed: WritableSignal<boolean> = signal(false);
  readonly pickerFailed: WritableSignal<string[]> = signal([]);
  readonly linking: WritableSignal<boolean> = signal(false);
  /** The picker's last finished link, for its status line and Undo, with the merchant it went to. */
  readonly lastLink: WritableSignal<{ merchantId: number; link: LastLink } | null> = signal(null);
  readonly linkUndoing: WritableSignal<boolean> = signal(false);
  readonly linkUndone: WritableSignal<UndoOutcome | null> = signal(null);
  /** The status line shows only while the panel is on the merchant the link went to. */
  readonly shownLastLink: Signal<LastLink | null> = computed((): LastLink | null => {
    const last = this.lastLink();
    if (!last) return null;
    const mode: MerchantPanelMode = this.mode();
    if (mode === 'merchant' && this.selected()?.id === last.merchantId) return last.link;
    if (mode === 'picker' && this.pickerTarget()?.id === last.merchantId) return last.link;
    return null;
  });
  /**
   * The rule offered after a picker link that covered exactly one group (PF-984), shown in the
   * merchant's panel the link returns to.
   */
  readonly pickerOffer: WritableSignal<RuleOffer | null> = signal<RuleOffer | null>(null);
  readonly shownOffer: Signal<RuleOffer | null> = computed((): RuleOffer | null => {
    const offer: RuleOffer | null = this.pickerOffer();
    return offer && this.mode() === 'merchant' && this.selected()?.id === offer.merchant.id
      ? offer
      : null;
  });
  /** An offer the panel no longer shows (another merchant, another step) is dropped, never brought back. */
  private readonly dropHiddenOffer = effect((): void => {
    if (this.pickerOffer() && !this.shownOffer()) this.pickerOffer.set(null);
  });
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
        return 'New merchant';
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
  private readonly picker = viewChild(DescriptionPickerComponent);
  private readonly unlinkedGroups = viewChild(UnlinkedGroupsComponent);
  private readonly offerCard = viewChild(RuleOfferComponent);
  /** The Unlinked group the add form was opened for, to hand the new merchant back to. */
  private createFor: string | null = null;
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** The element that had focus when the panel left the overview, to hand focus back to. */
  private focusReturn: HTMLElement | null = null;
  private loadSubscription: Subscription | null = null;
  private loadRun = 0;
  private linksSubscription: Subscription | null = null;
  private statsSubscription: Subscription | null = null;
  private pickerSubscription: Subscription | null = null;
  private pickerRun = 0;
  private readonly searchInput$: Subject<string> = new Subject<string>();
  private readonly pickerSearch$: Subject<string> = new Subject<string>();
  private readonly targetFilter$: Subject<string> = new Subject<string>();

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
    this.targetFilter$
      .pipe(
        debounceTime(DEBOUNCE_MS),
        switchMap((term: string) =>
          this.merchantApi
            .getMerchants(term.trim() || null, { page: 0, size: PAGE_SIZE })
            .pipe(catchError(() => EMPTY)),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res: PageResponse<Merchant>): void => this.targetOptions.set(res.content));
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => this.followUrl(params));
  }

  /** A tab was chosen: switch, after asking when what is about to be hidden has unsaved changes. */
  chooseView(next: MerchantView): void {
    if (next === this.view()) return;
    this.askBeforeLeavingView(next, (): void => {
      this.view.set(next);
      void this.router.navigate([], {
        queryParams: { view: next === 'merchants' ? null : next },
        queryParamsHandling: 'merge',
      });
    });
  }

  /** The route's `canDeactivate`: leaving with unsaved rule changes asks first. */
  canLeave(): Promise<boolean> {
    if (!this.rulesGuard.dirty()) return Promise.resolve(true);
    return new Promise<boolean>((resolve: (leave: boolean) => void): void => {
      this.confirmationService.confirm({
        header: 'Discard changes?',
        message: 'You have unsaved changes. Discard them?',
        acceptLabel: 'Discard',
        rejectLabel: 'Keep editing',
        acceptButtonStyleClass: 'p-button-danger',
        accept: (): void => resolve(true),
        reject: (): void => resolve(false),
      });
    });
  }

  /** "Create" was chosen for an Unlinked group: the add form opens with that name. */
  onCreateForGroup(request: CreateForGroup): void {
    this.startAdd(request.name, request.key);
  }

  /** Something was linked on the Unlinked tab: link counts and totals changed. */
  onGroupsLinked(): void {
    this.loadMerchants();
    this.loadStats();
  }

  /** Back or Forward changed the view in the URL: follow it, or put the URL back. */
  private followUrl(params: Params): void {
    const next: MerchantView = viewFromParam(params['view']);
    if (next === this.view()) return;
    this.askBeforeLeavingView(
      next,
      (): void => this.view.set(next),
      (): void => {
        void this.router.navigate([], {
          queryParams: { view: this.view() === 'merchants' ? null : this.view() },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      },
    );
  }

  /**
   * The rules tab and the panel are not shown together, so moving between them would drop unsaved
   * work in whichever is hidden: ask first.
   */
  private askBeforeLeavingView(next: MerchantView, proceed: () => void, keep?: () => void): void {
    if (this.view() === 'rules') {
      if (!this.rulesGuard.dirty()) {
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
        reject: keep,
      });
      return;
    }
    if (next === 'rules') {
      this.confirmDiscardIfDirty(proceed, keep);
      return;
    }
    proceed();
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
          if (term === '') this.merchantTotal.set(res.page.totalElements);
          this.loadedOnce.set(true);
          this.refreshSelected();
        },
        error: (err: unknown): void => {
          console.error('Failed to load merchants:', err);
          this.merchants.set([]);
          this.totalRecords.set(0);
          this.dataSearch.set(term);
          this.loadError.set(true);
        },
      });
  }

  /**
   * Loads the figures the overview needs: unlinked descriptions, whether any exist, and how many
   * merchants there are in all (the list's own total follows the search). A newer load replaces an
   * older one, and a failure is flagged so the overview can offer a retry.
   */
  loadStats(): void {
    this.statsSubscription?.unsubscribe();
    this.statsFailed.set(false);
    this.statsSubscription = forkJoin({
      unlinked: this.transactionApi.getDescriptions({ page: 0, size: 1, unlinkedOnly: true }),
      any: this.transactionApi.getDescriptions({ page: 0, size: 1 }),
      merchants: this.merchantApi.getMerchants(null, { page: 0, size: 1 }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ unlinked, any, merchants }): void => {
          this.unlinkedCount.set(unlinked.page.totalElements);
          this.hasTransactions.set(any.page.totalElements > 0);
          this.merchantTotal.set(merchants.page.totalElements);
        },
        error: (err: unknown): void => {
          console.error('Failed to load description totals:', err);
          this.statsFailed.set(true);
        },
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
      // an older link's status line belongs to the moment it was made, not to a later visit
      if (this.lastLink()?.merchantId !== merchant.id) this.dismissLastLink();
      this.selected.set(merchant);
      this.links.set([]);
      this.linksState.set('loading');
      this.go('merchant');
      this.loadLinks(merchant.id);
    });
  }

  /**
   * Opens the add form, optionally with the name already typed (from a search that found nothing,
   * or from an Unlinked group's Create, whose key is kept to hand the new merchant back to).
   */
  startAdd(prefill = '', forGroup: string | null = null): void {
    this.addPrefill.set(prefill);
    if (this.mode() === 'add') {
      this.createFor = forGroup;
      if (prefill !== '') this.editForm()?.form.controls.name.setValue(prefill);
      return;
    }
    this.confirmDiscardIfDirty((): void => {
      this.createFor = forGroup;
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
  closePanel(): void {
    this.createFor = null;
    this.selected.set(null);
    this.pickerTarget.set(null);
    this.go('overview');
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
            // the user may have opened another merchant while the save ran: only touch the form
            // and the selection if this one is still what they are looking at
            if (this.mode() === 'merchant' && this.selected()?.id === id) {
              this.editForm()?.form.markAsPristine();
              this.selected.update(
                (current: Merchant | null): Merchant | null =>
                  current && { ...current, ...this.asMerchantFields(value) },
              );
            }
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
            const forGroup: string | null = this.createFor;
            this.createFor = null;
            if (forGroup !== null && this.view() === 'unlinked') {
              // back to the group it was created for, with the new merchant chosen in its field
              this.closePanel();
              this.unlinkedGroups()?.merchantCreated(forGroup, created);
            } else {
              this.selected.set(created);
              this.links.set([]);
              this.showPicker(created, true);
            }
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
          // another merchant may be open by now; its links must not be replaced by these
          if (this.selected()?.id === merchant.id) this.loadLinks(merchant.id);
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
    // the "Link to" select this was chosen in is replaced by the picker, which would drop focus
    // onto the page
    afterNextRender((): void => this.panel()?.focus(), { injector: this.injector });
  }

  /** Narrows the "Link to" choice by name (debounced; an older answer never replaces a newer one). */
  onTargetFilter(term: string): void {
    this.targetFilter$.next(term);
  }

  onPickerSearch(term: string): void {
    this.pickerSearch.set(term);
    this.pickerSearch$.next(term);
  }

  onPickerToggle(unlinkedOnly: boolean): void {
    this.pickerUnlinkedOnly.set(unlinkedOnly);
    this.loadPickerRows(true);
  }

  /** Retries whatever picker load failed: the first page, or the page "Show more" asked for. */
  retryPicker(): void {
    this.loadPickerRows(this.pickerGroups().length === 0);
  }

  onPickerShowMore(): void {
    if (this.pickerLoading() || this.pickerGroups().length >= this.pickerTotal()) return;
    this.loadPickerRows(false);
  }

  /**
   * Checks the ticked descriptions for look-alikes, then links them. Warnings stop the link and
   * show the guard in the picker; a failed check links anyway, since the check only advises.
   */
  onLink(descriptions: string[]): void {
    const target: Merchant | null = this.pickerTarget();
    if (!target || this.linking() || this.linkUndoing() || descriptions.length === 0) return;
    this.linking.set(true);
    this.pickerFailed.set([]);
    this.pickerWarnings.set([]);
    this.merchantApi
      .checkDescriptionLinks(target.id, descriptions)
      .pipe(
        catchError((): Observable<DescriptionLinkCheck | null> => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((check: DescriptionLinkCheck | null): void => {
        const stillHere: boolean =
          this.mode() === 'picker' && this.pickerTarget()?.id === target.id;
        // leaving the picker while the check ran cancels the link, warned or not
        if (!stillHere) {
          this.linking.set(false);
          return;
        }
        if (check && check.warnings.length > 0) {
          this.linking.set(false);
          this.pickerWarnings.set(check.warnings);
          return;
        }
        this.linkTo(target, descriptions);
      });
  }

  /** The guard's choice in the picker: link these without checking again. */
  onLinkChecked(descriptions: string[]): void {
    const target: Merchant | null = this.pickerTarget();
    this.pickerWarnings.set([]);
    if (!target || this.linking() || this.linkUndoing() || descriptions.length === 0) return;
    this.linking.set(true);
    this.pickerFailed.set([]);
    this.linkTo(target, descriptions);
  }

  /** The picker's offer was answered: it closes and focus goes back to the panel. */
  closePickerOffer(created: boolean): void {
    if (!this.pickerOffer()) return;
    this.pickerOffer.set(null);
    if (created) this.loadStats();
    afterNextRender((): void => this.panel()?.focus(), { injector: this.injector });
  }

  dismissPickerWarnings(): void {
    this.pickerWarnings.set([]);
  }

  /**
   * Takes the last link back, then reloads what it changed: the counts, the merchant's links and
   * the picker's groups.
   */
  undoLastLink(): void {
    const last = this.lastLink();
    if (!last || this.linkUndoing() || this.linkUndone()) return;
    // the offer was for the link being taken back
    this.pickerOffer.set(null);
    this.linkUndoing.set(true);
    undoLink(this.merchantApi, last.link)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.linkUndoing.set(false)),
      )
      .subscribe((outcome: UndoOutcome): void => {
        // a link made since replaced the status line; this undo's outcome is not about it
        if (this.lastLink() === last) this.linkUndone.set(outcome);
        this.loadMerchants();
        this.loadStats();
        if (this.selected()?.id === last.merchantId) this.loadLinks(last.merchantId);
        if (this.mode() === 'picker') this.loadPickerRows(true);
      });
  }

  dismissLastLink(): void {
    this.lastLink.set(null);
    this.linkUndone.set(null);
  }

  /**
   * Links descriptions to the target in bulk requests of at most 500 (one request for almost
   * every selection). The status line reports what was linked, with Undo. A failed request leaves
   * its descriptions ticked in the picker and the toast names the counts and the first message.
   */
  private linkTo(target: Merchant, descriptions: string[]): void {
    this.pickerOffer.set(null);
    const group: DescriptionGroup | null = this.onlyGroupOf(descriptions);
    const focusAtStart: Element | null = document.activeElement;
    linkInBatches(this.merchantApi, target.id, descriptions)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.linking.set(false)),
      )
      .subscribe((results: LinkOutcome[]): void => {
        const failed: LinkOutcome[] = results.filter((r: LinkOutcome): boolean => !r.ok);
        const failedDescriptions: string[] = failed.flatMap((r: LinkOutcome): string[] => r.items);
        const linked: number = descriptions.length - failedDescriptions.length;
        const done: LastLink | null = lastLinkOf(target.name, results);
        if (done) {
          this.lastLink.set({ merchantId: target.id, link: done });
          this.linkUndone.set(null);
        }
        this.loadMerchants();
        this.loadStats();
        const stillHere: boolean =
          this.mode() === 'picker' && this.pickerTarget()?.id === target.id;
        if (failed.length === 0) {
          if (stillHere) {
            this.selected.set(target);
            this.go('merchant');
            this.loadLinks(target.id);
            if (group) this.offerRule(group, target, descriptions, focusAtStart);
          } else if (this.selected()?.id === target.id) {
            this.loadLinks(target.id);
          }
          return;
        }
        this.toast.error(
          `Linked ${linked}, ${failedDescriptions.length} failed: ${failed[0].message}`,
        );
        if (stillHere) {
          this.pickerFailed.set(failedDescriptions);
          this.loadPickerRows(true);
        }
        if (this.selected()?.id === target.id) this.loadLinks(target.id);
      });
  }

  /**
   * The one picker group every description belongs to, or null when they span several: a rule is
   * offered only for a single group, whose key is the keyword.
   */
  private onlyGroupOf(descriptions: string[]): DescriptionGroup | null {
    const wanted = new Set<string>(descriptions);
    const touched: DescriptionGroup[] = this.pickerGroups().filter((g: DescriptionGroup): boolean =>
      g.variants.some((v: TransactionDescription): boolean => wanted.has(v.description)),
    );
    return touched.length === 1 ? touched[0] : null;
  }

  /** Offers a rule for the group just linked, with focus on the offer once the panel shows it. */
  private offerRule(
    group: DescriptionGroup,
    merchant: Merchant,
    descriptions: string[],
    focusAtStart: Element | null,
  ): void {
    this.pickerOffer.set({
      key: group.key,
      merchant,
      descriptions,
      anchorKey: null,
      nextKey: null,
    });
    // runs after go()'s own focus move, so the offer ends up with focus, unless the user moved
    // focus elsewhere while the link ran (it was still in the picker, or dropped to the page)
    const now: Element | null = document.activeElement;
    if (now !== focusAtStart && now !== null && now !== document.body) return;
    afterNextRender((): void => this.offerCard()?.focus(), { injector: this.injector });
  }

  private showPicker(target: Merchant | null, unlinkedOnly: boolean): void {
    this.pickerTarget.set(target);
    this.pickerUnlinkedOnly.set(unlinkedOnly);
    this.pickerSearch.set('');
    this.pickerFailed.set([]);
    this.pickerGroups.set([]);
    this.pickerWarnings.set([]);
    this.pickerLoadFailed.set(false);
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
    this.pickerLoadFailed.set(false);
    this.pickerSubscription = this.transactionApi
      .getDescriptionGroups({
        search: this.pickerSearch(),
        unlinkedOnly: this.pickerUnlinkedOnly(),
        page,
        size: PICKER_PAGE_SIZE,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => {
          if (run === this.pickerRun) this.pickerLoading.set(false);
        }),
      )
      .subscribe({
        next: (res: DescriptionGroupPage): void => {
          this.pickerGroups.set(reset ? res.content : [...this.pickerGroups(), ...res.content]);
          this.pickerTotal.set(res.page.totalElements);
          this.pickerPage.set(page);
        },
        error: (err: unknown): void => {
          console.error('Failed to load descriptions:', err);
          if (run === this.pickerRun) this.pickerLoadFailed.set(true);
        },
      });
  }

  /** Retries loading the selected merchant's linked descriptions after a failure. */
  retryLinks(): void {
    const merchant: Merchant | null = this.selected();
    if (!merchant) return;
    this.linksState.set('loading');
    this.loadLinks(merchant.id);
  }

  /** Reloads the list after a failure and keeps focus in the search box, since Retry leaves the page. */
  retryList(): void {
    this.loadMerchants();
    this.searchInput()?.nativeElement.focus();
  }

  /** Loads a merchant's linked descriptions; a merchant that is gone sends the panel to the overview. */
  private loadLinks(merchantId: number): void {
    this.linksSubscription?.unsubscribe();
    this.linksSubscription = this.merchantApi
      .getDescriptionLinks(merchantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (links: MerchantDescriptionLink[]): void => {
          this.links.set(links);
          this.linksState.set('loaded');
        },
        error: (error: HttpErrorResponse): void => {
          if (error.status === 404 && this.selected()?.id === merchantId) {
            this.closePanel();
            this.toast.error('That merchant no longer exists.');
            this.loadMerchants();
            return;
          }
          this.linksState.set('failed');
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
  private go(mode: MerchantPanelMode): void {
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
  private confirmDiscardIfDirty(proceed: () => void, keep?: () => void): void {
    const mode: MerchantPanelMode = this.mode();
    const tickedCount: number = mode === 'picker' ? (this.picker()?.tickedCount() ?? 0) : 0;
    const dirty: boolean =
      ((mode === 'merchant' || mode === 'add') && !!this.editForm()?.form.dirty) || tickedCount > 0;
    if (!dirty) {
      proceed();
      return;
    }
    const ticks: boolean = tickedCount > 0;
    this.confirmationService.confirm({
      header: ticks ? 'Discard selection?' : 'Discard changes?',
      message: ticks
        ? `You have ${tickedCount} ${tickedCount === 1 ? 'description' : 'descriptions'} ticked that are not linked yet. Discard the selection?`
        : 'You have unsaved changes. Discard them?',
      acceptLabel: 'Discard',
      rejectLabel: 'Keep editing',
      acceptButtonStyleClass: 'p-button-danger',
      accept: proceed,
      reject: keep,
    });
  }
}
