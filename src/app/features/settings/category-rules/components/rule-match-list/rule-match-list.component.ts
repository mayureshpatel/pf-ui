import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  signal,
  Signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  catchError,
  defer,
  distinctUntilChanged,
  map,
  merge,
  Observable,
  of,
  Subject,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { ruleKeywordsText } from '../../../utils/settings-helpers';
import { fromLocalDateString } from '@shared/utils/transaction.utils';
import { RuleDraft } from '@models/category-rule.model';
import { Transaction } from '@models/transaction.model';
import {
  MatchPreviewData,
  MatchRowData,
  MatchRuleRef,
  RULE_MATCH_CONFIG,
  RuleMatchConfig,
} from './rule-match-config';

/** How long the list waits after the last draft change before asking the server. */
const DEBOUNCE_MS = 300;

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** What to fetch next: a draft (debounced unless retrying), or nothing when the keyword is empty. */
interface Trigger {
  draft: RuleDraft | null;
  debounce: boolean;
}

/** The outcome of one fetch, or the reset when there is nothing to fetch. */
type Outcome = { kind: 'idle' } | { kind: 'ok'; preview: MatchPreviewData } | { kind: 'error' };

/** A matched row prepared for display. */
interface MatchRowView {
  row: MatchRowData;
  date: Date | null;
  /** the rule that beats the draft on a `LOSES_TO_OTHER_RULE` row */
  winner: MatchRuleRef | null;
  /** the remaining matching rules, listed compactly */
  alsoMatches: MatchRuleRef[];
}

/** One group of the ledger's selectable list: what will happen to its rows. */
interface MatchGroupView {
  key: 'set' | 'change' | 'keep';
  title: string;
  /** how many matches the group holds in all, listed or not */
  total: number;
  rows: MatchRowView[];
  /** every id the group's checkbox covers: its listed rows, plus unlisted blank matches for `set` */
  ids: number[];
}

/** A selected transaction shown as context while the keyword is empty. */
interface ContextRowView {
  id: number;
  date: Date | null;
  description: string;
  amount: number;
}

/**
 * The calendar date of an ISO date or date-time, as the ledger shows it (`iso.substring(0, 10)`),
 * at local midnight.
 * @returns null for a missing, malformed or impossible date, which `DatePipe` would throw on
 */
function calendarDate(iso: string | null | undefined): Date | null {
  if (typeof iso !== 'string') return null;
  const day: string = iso.substring(0, 10);
  if (!CALENDAR_DATE.test(day)) return null;
  const date: Date = fromLocalDateString(day);
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  const valid: boolean =
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === dayOfMonth;
  return valid ? date : null;
}

/** The draft with blank keywords dropped, or null when no keyword is left to match on. */
function activeDraft(draft: RuleDraft | null): RuleDraft | null {
  if (!draft) return null;
  const keywords: string[] = draft.keywords.map((k) => k.trim()).filter((k) => k.length > 0);
  return keywords.length === 0 ? null : { ...draft, keywords };
}

function sameDraft(a: RuleDraft | null, b: RuleDraft | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The live "what would this rule match" list shown under a rule form. It previews the draft
 * against the whole ledger on the server, 300 ms after the draft stops changing; a newer draft
 * cancels any request still in flight, so a slow earlier answer never replaces a newer one. While
 * the draft has no keyword it prompts for one and lists the `context` transactions instead.
 *
 * The same list serves every kind of rule: how a draft is previewed and what the verdicts say come
 * from the {@link RULE_MATCH_CONFIG} in scope (category rules unless a host provides another).
 */
@Component({
  selector: 'app-rule-match-list',
  imports: [DatePipe, FormatCurrencyPipe, NgTemplateOutlet],
  templateUrl: './rule-match-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleMatchListComponent {
  private readonly config: RuleMatchConfig = inject(RULE_MATCH_CONFIG);
  protected readonly labels = this.config.labels;
  private readonly injector: Injector = inject(Injector);

  /** The rule being drafted; null or keyword-less shows the prompt. */
  readonly draft: InputSignal<RuleDraft | null> = input<RuleDraft | null>(null);
  /** The selected transactions, shown as context while the keyword is empty. */
  readonly context: InputSignal<Transaction[]> = input<Transaction[]>([]);
  /**
   * Shows each match with a checkbox, grouped by what will happen to it (PF-926): the ledger's rule
   * panel, where the owner chooses which rows the rule changes. Off in Settings.
   */
  readonly selectable: InputSignal<boolean> = input<boolean>(false);
  /** What the rule would set, for the "was X, becomes Y" line of a row that already has a value. */
  readonly becomes: InputSignal<string | null> = input<string | null>(null);
  /** Emits the ids of the ticked matches whenever they change (only while `selectable`). */
  readonly selectionChange: OutputEmitterRef<number[]> = output<number[]>();
  /**
   * True when the form holds keywords the server would refuse (the draft is null then): the list
   * asks for a fix instead of prompting for a keyword.
   */
  readonly invalid: InputSignal<boolean> = input<boolean>(false);

  protected readonly preview: WritableSignal<MatchPreviewData | null> = signal(null);
  protected readonly loading: WritableSignal<boolean> = signal(false);
  protected readonly failed: WritableSignal<boolean> = signal(false);
  /**
   * The list's height when a new draft arrived, kept as its minimum until that draft settles, so
   * the panel does not jump while the answer is on its way (e.g. an error alert giving way to the
   * loading line). Null when nothing is held.
   */
  protected readonly heldHeight: WritableSignal<number | null> = signal<number | null>(null);

  private readonly active: Signal<RuleDraft | null> = computed(() => activeDraft(this.draft()), {
    equal: sameDraft,
  });
  protected readonly hasKeyword: Signal<boolean> = computed(() => this.active() !== null);
  private readonly retry$: Subject<void> = new Subject<void>();
  private readonly retryButton: Signal<ElementRef<HTMLButtonElement> | undefined> =
    viewChild<ElementRef<HTMLButtonElement>>('retryButton');
  private readonly region: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild<ElementRef<HTMLElement>>('region');
  /** Set when Retry is pressed from the keyboard focus, so a success can hand focus on. */
  private retryHadFocus = false;

  protected readonly contextRows: Signal<ContextRowView[]> = computed(() =>
    this.context().map((t) => ({
      id: t.id,
      date: calendarDate(t.date),
      description: t.description,
      amount: t.amount,
    })),
  );

  protected readonly rows: Signal<MatchRowView[]> = computed(() =>
    (this.preview()?.rows ?? []).map((row) => ({
      row,
      date: calendarDate(row.date),
      winner: row.winner,
      alsoMatches: row.alsoMatches,
    })),
  );

  /** Which matches are ticked, by transaction id; rows the preview no longer holds are dropped. */
  private readonly tickState: WritableSignal<ReadonlyMap<number, boolean>> = signal(new Map());

  /** The groups of the selectable list; empty groups are left out. */
  protected readonly groups: Signal<MatchGroupView[]> = computed((): MatchGroupView[] => {
    const p: MatchPreviewData | null = this.preview();
    if (!p) return [];
    const all: MatchRowView[] = this.rows();
    const listed = (verdicts: string[]): MatchRowView[] =>
      all.filter((item: MatchRowView): boolean => verdicts.includes(item.row.verdict));
    const set: MatchRowView[] = listed(['WILL_APPLY']);
    const unique = (ids: number[]): number[] => Array.from(new Set(ids));
    const groups: MatchGroupView[] = [
      {
        key: 'set',
        title: this.labels.groupSet,
        total: p.willApplyCount,
        rows: set,
        ids: unique([...set.map((i) => i.row.transactionId), ...p.willApplyIds]),
      },
      {
        key: 'change',
        title: this.labels.groupChange,
        total: p.alreadySetCount,
        rows: listed(['ALREADY_SET']),
        ids: listed(['ALREADY_SET']).map((i) => i.row.transactionId),
      },
      {
        key: 'keep',
        title: this.labels.groupKeep,
        total: p.losesToOtherRuleCount + p.linkedCount,
        rows: listed(['LOSES_TO_OTHER_RULE', 'LINKED']),
        ids: listed(['LOSES_TO_OTHER_RULE', 'LINKED']).map((i) => i.row.transactionId),
      },
    ];
    return groups.filter((g: MatchGroupView): boolean => g.total > 0);
  });

  /** The ids of the ticked matches, in the order the groups list them. */
  protected readonly ticked: Signal<number[]> = computed((): number[] => {
    const state: ReadonlyMap<number, boolean> = this.tickState();
    return this.groups()
      .flatMap((g: MatchGroupView): number[] => g.ids)
      .filter((id: number): boolean => state.get(id) === true);
  });

  /** Matches beyond the capped rows. */
  protected readonly moreCount: Signal<number> = computed(() => {
    const p: MatchPreviewData | null = this.preview();
    return p && p.truncated ? Math.max(0, p.totalMatches - p.rows.length) : 0;
  });

  /**
   * Of the rows the draft would handle, those no other rule also matches. Only known when every
   * match is in `rows`, so null when the list is truncated.
   */
  protected readonly unopposedCount: Signal<number | null> = computed(() => {
    const p: MatchPreviewData | null = this.preview();
    if (!p || p.truncated) return null;
    return p.rows.filter((r) => r.verdict === 'WILL_APPLY' && r.alsoMatches.length === 0).length;
  });

  constructor() {
    effect((): void => {
      const ids: number[] = this.ticked();
      if (this.selectable()) {
        this.selectionChange.emit(ids);
      }
    });

    const drafts$: Observable<Trigger> = toObservable(this.active).pipe(
      distinctUntilChanged(sameDraft),
      // a new draft replaces the failed one at once, not only when its own request settles
      tap((): void => {
        this.holdHeight();
        this.failed.set(false);
        this.retryHadFocus = false;
      }),
      map((draft) => ({ draft, debounce: true })),
    );
    const retries$: Observable<Trigger> = this.retry$.pipe(
      map(() => ({ draft: this.active(), debounce: false })),
    );

    merge(drafts$, retries$)
      .pipe(
        switchMap((trigger: Trigger) => this.fetch(trigger)),
        takeUntilDestroyed(),
      )
      .subscribe((outcome: Outcome) => this.settle(outcome));
  }

  /**
   * Asks again for the current draft after a failed request. The alert and its button stay while
   * the retry is in flight (the button says so), so keyboard focus is never dropped; a press while
   * one is in flight is ignored.
   */
  protected retry(): void {
    if (this.loading()) return;
    this.retryHadFocus = document.activeElement === this.retryButton()?.nativeElement;
    this.retry$.next();
  }

  /** Names another rule by its keywords, with the neutral wording of {@link ruleKeywordsText}. */
  protected keywordsText(ruleRef: MatchRuleRef): string {
    return ruleKeywordsText(ruleRef.keywords);
  }

  /** True when the match is currently ticked. */
  protected isTicked(id: number): boolean {
    return this.tickState().get(id) === true;
  }

  /** Ticks or unticks one match. */
  protected toggleRow(id: number): void {
    this.tickState.update((state: ReadonlyMap<number, boolean>) =>
      new Map(state).set(id, state.get(id) !== true),
    );
  }

  /** True when every match of the group is ticked. */
  protected allTicked(group: MatchGroupView): boolean {
    return group.ids.length > 0 && group.ids.every((id: number): boolean => this.isTicked(id));
  }

  /** True when some, but not all, matches of the group are ticked. */
  protected someTicked(group: MatchGroupView): boolean {
    return !this.allTicked(group) && group.ids.some((id: number): boolean => this.isTicked(id));
  }

  /** Unticks the whole group when it is fully ticked, otherwise ticks all of it. */
  protected toggleGroup(group: MatchGroupView): void {
    const tick = !this.allTicked(group);
    this.tickState.update((state: ReadonlyMap<number, boolean>) => {
      const next = new Map<number, boolean>(state);
      group.ids.forEach((id: number): void => void next.set(id, tick));
      return next;
    });
  }

  /**
   * Carries the ticks over to a new preview: a match that is still there keeps its tick, a new
   * one starts ticked only if the rule would set it (it has no value today), and a match that is
   * gone is forgotten.
   */
  private reconcileTicks(): void {
    const p: MatchPreviewData | null = this.preview();
    const next = new Map<number, boolean>();
    if (p) {
      const previous: ReadonlyMap<number, boolean> = this.tickState();
      const keep = (id: number, byDefault: boolean): void => {
        next.set(id, previous.has(id) ? previous.get(id) === true : byDefault);
      };
      p.rows.forEach((row: MatchRowData): void =>
        keep(row.transactionId, row.verdict === 'WILL_APPLY'),
      );
      p.willApplyIds
        .filter((id: number): boolean => !next.has(id))
        .forEach((id: number): void => keep(id, true));
    }
    this.tickState.set(next);
  }

  /** Keeps the list at least as tall as it is now, until the next outcome settles. */
  private holdHeight(): void {
    const height: number | undefined = this.region()?.nativeElement.offsetHeight;
    this.heldHeight.set(height ? height : null);
  }

  private fetch({ draft, debounce }: Trigger): Observable<Outcome> {
    if (!draft) return of<Outcome>({ kind: 'idle' });
    const request$: Observable<Outcome> = defer(() => {
      this.loading.set(true);
      return this.config.preview(draft);
    }).pipe(
      map((preview: MatchPreviewData): Outcome => ({ kind: 'ok', preview })),
      catchError(() => of<Outcome>({ kind: 'error' })),
    );
    return debounce ? timer(DEBOUNCE_MS).pipe(switchMap(() => request$)) : request$;
  }

  private settle(outcome: Outcome): void {
    this.heldHeight.set(null);
    this.loading.set(false);
    this.failed.set(outcome.kind === 'error');
    this.preview.set(outcome.kind === 'ok' ? outcome.preview : null);
    this.reconcileTicks();
    // a retry that succeeds removes the focused button: focus moves to the list region instead
    if (outcome.kind !== 'error' && this.retryHadFocus) {
      this.retryHadFocus = false;
      afterNextRender(
        { read: (): void => this.region()?.nativeElement.focus() },
        {
          injector: this.injector,
        },
      );
    }
  }
}
