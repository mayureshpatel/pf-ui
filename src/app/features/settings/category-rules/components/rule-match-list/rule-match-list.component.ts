import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  InputSignal,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
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
  timer,
} from 'rxjs';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { fromLocalDateString } from '@shared/utils/transaction.utils';
import { RuleDraft, RuleMatchPreview, RuleMatchRow, RuleRef } from '@models/category-rule.model';
import { Transaction } from '@models/transaction.model';
import { CategoryRuleApiService } from '../../services/category-rule-api.service';

/** How long the list waits after the last draft change before asking the server. */
const DEBOUNCE_MS = 300;

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** What to fetch next: a draft (debounced unless retrying), or nothing when the keyword is empty. */
interface Trigger {
  draft: RuleDraft | null;
  debounce: boolean;
}

/** The outcome of one fetch, or the reset when there is nothing to fetch. */
type Outcome = { kind: 'idle' } | { kind: 'ok'; preview: RuleMatchPreview } | { kind: 'error' };

/** A matched row prepared for display. */
interface MatchRowView {
  row: RuleMatchRow;
  date: Date | null;
  /** the rule that beats the draft on a `LOSES_TO_OTHER_RULE` row */
  winner: RuleRef | null;
  /** the remaining matching rules, listed compactly */
  alsoMatches: RuleRef[];
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
 */
@Component({
  selector: 'app-rule-match-list',
  imports: [DatePipe, FormatCurrencyPipe],
  templateUrl: './rule-match-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleMatchListComponent {
  private readonly api: CategoryRuleApiService = inject(CategoryRuleApiService);

  /** The rule being drafted; null or keyword-less shows the prompt. */
  readonly draft: InputSignal<RuleDraft | null> = input<RuleDraft | null>(null);
  /** The selected transactions, shown as context while the keyword is empty. */
  readonly context: InputSignal<Transaction[]> = input<Transaction[]>([]);

  protected readonly preview: WritableSignal<RuleMatchPreview | null> = signal(null);
  protected readonly loading: WritableSignal<boolean> = signal(false);
  protected readonly failed: WritableSignal<boolean> = signal(false);

  private readonly active: Signal<RuleDraft | null> = computed(() => activeDraft(this.draft()), {
    equal: sameDraft,
  });
  protected readonly hasKeyword: Signal<boolean> = computed(() => this.active() !== null);
  private readonly retry$: Subject<void> = new Subject<void>();

  protected readonly contextRows: Signal<ContextRowView[]> = computed(() =>
    this.context().map((t) => ({
      id: t.id,
      date: calendarDate(t.date),
      description: t.description,
      amount: t.amount,
    })),
  );

  protected readonly rows: Signal<MatchRowView[]> = computed(() =>
    (this.preview()?.rows ?? []).map((row) => {
      const winner: RuleRef | null =
        row.verdict === 'LOSES_TO_OTHER_RULE' ? (row.otherRules[0] ?? null) : null;
      return {
        row,
        date: calendarDate(row.date),
        winner,
        alsoMatches: winner ? row.otherRules.slice(1) : row.otherRules,
      };
    }),
  );

  /** Matches beyond the capped rows. */
  protected readonly moreCount: Signal<number> = computed(() => {
    const p: RuleMatchPreview | null = this.preview();
    return p && p.truncated ? Math.max(0, p.totalMatches - p.rows.length) : 0;
  });

  /**
   * Of the rows the draft would categorize, those no other rule also matches. Only known when
   * every match is in `rows`, so null when the list is truncated.
   */
  protected readonly unopposedCount: Signal<number | null> = computed(() => {
    const p: RuleMatchPreview | null = this.preview();
    if (!p || p.truncated) return null;
    return p.rows.filter((r) => r.verdict === 'WILL_CATEGORIZE' && r.otherRules.length === 0)
      .length;
  });

  constructor() {
    const drafts$: Observable<Trigger> = toObservable(this.active).pipe(
      distinctUntilChanged(sameDraft),
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

  /** Asks again for the current draft after a failed request. */
  protected retry(): void {
    this.retry$.next();
  }

  protected keywordsText(ruleRef: RuleRef): string {
    return ruleRef.keywords.join(', ');
  }

  private fetch({ draft, debounce }: Trigger): Observable<Outcome> {
    if (!draft) return of<Outcome>({ kind: 'idle' });
    const request$: Observable<Outcome> = defer(() => {
      this.loading.set(true);
      return this.api.previewMatches(draft);
    }).pipe(
      map((preview: RuleMatchPreview): Outcome => ({ kind: 'ok', preview })),
      catchError(() => of<Outcome>({ kind: 'error' })),
    );
    return debounce ? timer(DEBOUNCE_MS).pipe(switchMap(() => request$)) : request$;
  }

  private settle(outcome: Outcome): void {
    this.loading.set(false);
    this.failed.set(outcome.kind === 'error');
    this.preview.set(outcome.kind === 'ok' ? outcome.preview : null);
  }
}
