import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  InputSignal,
  OnInit,
  output,
  OutputEmitterRef,
  signal,
  Signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Params, Router } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { Account, AccountType } from '@models/account.model';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';
import { NetWorthBreakdown, NetWorthGroup } from '../../models/reports.model';
import { ReportApiService } from '../../services/report-api.service';
import { accountsQuery } from '../../utils/net-worth-helpers';
import {
  defaultNetWorthState,
  fromNetWorthParams,
  NetWorthState,
  toNetWorthParams,
} from '../../utils/net-worth-state';
import { NetWorthCardsComponent } from '../net-worth-cards/net-worth-cards.component';
import { NetWorthChartComponent } from '../net-worth-chart/net-worth-chart.component';
import { NetWorthControlsComponent } from '../net-worth-controls/net-worth-controls.component';
import { NetWorthMovedComponent } from '../net-worth-moved/net-worth-moved.component';
import { NetWorthStoryComponent } from '../net-worth-story/net-worth-story.component';
import { NetWorthTableComponent } from '../net-worth-table/net-worth-table.component';

/** What the container tells the page to put in the URL, and whether that is a new history entry (a drill). */
export interface NetWorthParamsChange {
  params: Params;
  push: boolean;
}

/** Only the net worth view's own URL parameters. */
const nwOnly = (params: Params): Params =>
  Object.fromEntries(Object.entries(params).filter(([key]) => key.startsWith('nw')));

/**
 * The Reports net worth view: owns its state, requests and drill, mirrors the state to the `nw*` URL
 * parameters through {@link paramsChange}, and lays out the controls, cards, what-moved panel, chart,
 * rows and the account story. A newer request cancels an older one, and a failed load clears the data.
 */
@Component({
  selector: 'app-net-worth-view',
  standalone: true,
  imports: [
    SkeletonModule,
    PageErrorStateComponent,
    NetWorthControlsComponent,
    NetWorthCardsComponent,
    NetWorthMovedComponent,
    NetWorthChartComponent,
    NetWorthTableComponent,
    NetWorthStoryComponent,
  ],
  templateUrl: './net-worth-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetWorthViewComponent implements OnInit {
  private readonly reportApi: ReportApiService = inject(ReportApiService);
  private readonly accountApi: AccountApiService = inject(AccountApiService);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The page's current URL parameters; this view follows its own `nw*` ones when they change underneath. */
  readonly params: InputSignal<Params> = input.required<Params>();
  /** The user's accounts, for the account filter. */
  readonly accounts: InputSignal<Account[]> = input.required<Account[]>();
  /** The state to put in the URL after a change. */
  readonly paramsChange: OutputEmitterRef<NetWorthParamsChange> = output<NetWorthParamsChange>();

  protected readonly state: WritableSignal<NetWorthState> = signal(defaultNetWorthState());
  protected readonly types: WritableSignal<AccountType[]> = signal([]);
  protected readonly breakdown: WritableSignal<NetWorthBreakdown | null> = signal(null);
  protected readonly loading: WritableSignal<boolean> = signal(false);
  protected readonly loadError: WritableSignal<boolean> = signal(false);
  /** First-load skeleton only; after that results stay visible (dimmed) while re-querying. */
  protected readonly loadedOnce: WritableSignal<boolean> = signal(false);
  protected readonly note: WritableSignal<string | null> = signal(null);

  private loadSubscription: Subscription | null = null;
  private loadRun = 0;

  protected readonly groupBy: Signal<'TYPE' | 'ACCOUNT'> = computed((): 'TYPE' | 'ACCOUNT' =>
    this.state().typeCode !== null || this.state().accountId !== null ? 'ACCOUNT' : 'TYPE',
  );
  protected readonly compareLabel: Signal<string | null> = computed(
    (): string | null => this.breakdown()?.comparison?.label ?? null,
  );
  protected readonly filtered: Signal<boolean> = computed(
    (): boolean => this.state().accountIds.length > 0 || this.state().typeCode !== null,
  );
  /** The drilled account's row, whose story is shown. */
  protected readonly selectedAccount: Signal<NetWorthGroup | null> = computed(
    (): NetWorthGroup | null =>
      this.state().accountId === null
        ? null
        : (this.breakdown()?.groups.find(
            (g: NetWorthGroup) => g.key === String(this.state().accountId),
          ) ?? null),
  );
  protected readonly typeLabel: Signal<string | null> = computed((): string | null => {
    const code: string | null = this.state().typeCode;
    if (code === null) return null;
    return this.types().find((t: AccountType) => t.code === code)?.label ?? code;
  });

  constructor() {
    effect((): void => {
      const incoming: Params = nwOnly(this.params());
      untracked((): void => this.followUrl(incoming));
    });
  }

  ngOnInit(): void {
    const { state, note } = fromNetWorthParams(nwOnly(this.params()));
    this.state.set(state);
    this.note.set(note);
    if (note) this.paramsChange.emit({ params: toNetWorthParams(state), push: false });
    this.accountApi
      .getAccountTypes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (types: AccountType[]): void => this.types.set(types),
        error: (error: unknown): void => console.error('Failed to load account types:', error),
      });
    this.load();
  }

  /** Merges a change from the controls, dropping a drilled account the account filter no longer allows. */
  protected onState(change: Partial<NetWorthState>): void {
    const previous: NetWorthState = this.state();
    let next: NetWorthState = { ...previous, ...change };
    if (
      next.accountId !== null &&
      next.accountIds.length > 0 &&
      !next.accountIds.includes(next.accountId)
    ) {
      next = { ...next, accountId: null };
    }
    const drilled: boolean =
      next.typeCode !== previous.typeCode || next.accountId !== previous.accountId;
    this.note.set(null);
    this.state.set(next);
    this.paramsChange.emit({ params: toNetWorthParams(next), push: drilled });
    this.load();
  }

  protected onMonth(month: string): void {
    this.onState({ month });
  }

  /** A row was clicked: an account type opens its accounts, an account opens its story. */
  protected onOpenGroup(group: NetWorthGroup): void {
    if (this.groupBy() === 'TYPE') {
      this.onState({ typeCode: group.typeCode, accountId: null });
    } else {
      this.onState({ accountId: Number(group.key) });
    }
  }

  /** One level out: from an account to its type's accounts, from a type to all types. */
  protected stepBack(): void {
    if (this.state().accountId !== null) {
      this.onState({ accountId: null });
    } else if (this.state().typeCode !== null) {
      this.onState({ typeCode: null });
    }
  }

  protected clearFilters(): void {
    this.onState({ accountIds: [], typeCode: null, accountId: null });
  }

  protected onExplorer(query: Params): void {
    void this.router.navigate(['/reports'], { queryParams: query });
  }

  protected onAccounts(accountId: number): void {
    void this.router.navigate(['/accounts'], { queryParams: accountsQuery(accountId) });
  }

  protected addAccount(): void {
    void this.router.navigate(['/accounts']);
  }

  protected load(): void {
    this.loadSubscription?.unsubscribe();
    const run: number = ++this.loadRun;
    this.loading.set(true);
    this.loadError.set(false);
    this.loadSubscription = this.reportApi
      .getNetWorthBreakdown(this.state())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => {
          if (run === this.loadRun) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (breakdown: NetWorthBreakdown): void => {
          this.breakdown.set(breakdown);
          this.loadedOnce.set(true);
        },
        error: (error: unknown): void => {
          console.error('Failed to load the net worth breakdown:', error);
          this.breakdown.set(null);
          this.loadError.set(true);
        },
      });
  }

  /** Follows the URL when it changes underneath (back and forward), ignoring what this view wrote itself. */
  private followUrl(incoming: Params): void {
    const { state, note } = fromNetWorthParams(incoming);
    if (JSON.stringify(toNetWorthParams(state)) === JSON.stringify(toNetWorthParams(this.state())))
      return;
    this.state.set(state);
    this.note.set(note);
    this.load();
  }
}
