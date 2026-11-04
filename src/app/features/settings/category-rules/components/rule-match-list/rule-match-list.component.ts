import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  InputSignal,
  signal,
  Signal,
  viewChild,
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
  tap,
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
  private readonly injector: Injector = inject(Injector);

  /** The rule being drafted; null or keyword-less shows the prompt. */
  readonly draft: InputSignal<RuleDraft | null> = input<RuleDraft | null>(null);
  /** The selected transactions, shown as context while the keyword is empty. */
  readonly context: InputSignal<Transaction[]> = input<Transaction[]>([]);
  /**
   * True when the form holds keywords the server would refuse (the draft is null then): the list
   * asks for a fix instead of prompting for a keyword.
   */
  readonly invalid: InputSignal<boolean> = input<boolean>(false);

  protected readonly preview: WritableSignal<RuleMatchPreview | null> = signal(null);
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

  /**
   * Another rule's keywords, each quoted and joined by " + ". The preview does not say whether that
   * rule needs any or all of them, so a plain comma (which reads as "or") would claim too much.
   */
  protected keywordsText(ruleRef: RuleRef): string {
    return ruleRef.keywords.map((k: string): string => `"${k}"`).join(' + ');
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
      return this.api.previewMatches(draft);
    }).pipe(
      map((preview: RuleMatchPreview): Outcome => ({ kind: 'ok', preview })),
      catchError(() => of<Outcome>({ kind: 'error' })),
    );
    return debounce ? timer(DEBOUNCE_MS).pipe(switchMap(() => request$)) : request$;
  }

  private settle(outcome: Outcome): void {
    this.heldHeight.set(null);
    this.loading.set(false);
    this.failed.set(outcome.kind === 'error');
    this.preview.set(outcome.kind === 'ok' ? outcome.preview : null);
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
