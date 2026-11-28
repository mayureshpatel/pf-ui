import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  InputSignal,
  OnInit,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  catchError,
  debounceTime,
  finalize,
  map,
  Observable,
  of,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { Merchant } from '@models/merchant.model';
import {
  MerchantRule,
  MerchantRuleCoverage,
  MerchantRuleDraft,
  MerchantRuleMatchPreview,
  MerchantRuleOverlap,
  MerchantRuleRef,
} from '@models/merchant-rule.model';
import { ToastService } from '@core/services/toast.service';
import { MerchantRuleApiService } from '@features/settings/merchant-rules/merchant-rule-api.service';
import {
  createRuleForm,
  RuleFormBase,
  RuleFormControls,
} from '@features/settings/rule-form/rule-form-base';
import { RuleFormFieldsComponent } from '@features/settings/rule-form/rule-form-fields.component';

/** How long the preview waits after the last edit before asking the server. */
const PREVIEW_DEBOUNCE_MS = 300;

type OfferForm = FormGroup<RuleFormControls>;

/** The preview of the drafted rule: not asked yet (or no keyword), on its way, failed, or back. */
type PreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ok'; key: string; preview: MerchantRuleMatchPreview };

/** The reasons an overlap's winner wins, as the sentence ends them. */
const REASON_TEXT: Record<MerchantRuleOverlap['reason'], string> = {
  LINK: 'linked descriptions',
  HIGHER_PRIORITY: 'higher priority',
  LONGER_KEYWORDS: 'longer keywords',
  LOWER_ID: 'saved first',
};

function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** A keyword set as the card names it: `kroger`, or `kroger` + `fuel`. */
export function keywordsLabel(keywords: string[]): string {
  return keywords.map((k: string): string => `\`${k}\``).join(' + ');
}

/**
 * The sentence for one overlap (PF-981): who gets the shared descriptions, how many, and why, as
 * in "Kroger Fuel Center wins on 6 descriptions: longer keywords".
 */
export function overlapSentence(overlap: MerchantRuleOverlap): string {
  const count: string = plural(overlap.descriptionCount, 'description');
  const reason: string = REASON_TEXT[overlap.reason];
  return overlap.outcome === 'OTHER_WINS'
    ? `${overlap.merchantName} wins on ${count}: ${reason}`
    : `This rule takes ${count} from ${overlap.merchantName}: ${reason}`;
}

/**
 * The offer shown after a group of descriptions was linked to a merchant (PF-984): "Also create
 * rule: `kroger` → Kroger", so later imports with new store numbers find the merchant too. The
 * group's key is the keyword; nothing is created until the user confirms.
 *
 * It first asks whether the merchant's rules already win every description (as import would pick);
 * then it only says so. Otherwise it previews the drafted rule live (how many transactions it
 * matches and where it meets another merchant), lets keywords, match type, priority and amount be
 * edited with the shared rule fields, and can fill the blank transactions it matches in the same
 * step, through create-and-apply. Enter creates; Escape or Skip dismisses.
 */
@Component({
  selector: 'app-rule-offer',
  standalone: true,
  imports: [ReactiveFormsModule, RuleFormFieldsComponent],
  templateUrl: './rule-offer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleOfferComponent
  extends RuleFormBase<MerchantRule, OfferForm, MerchantRuleDraft>
  implements OnInit
{
  private readonly ruleApi: MerchantRuleApiService = inject(MerchantRuleApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly injector: Injector = inject(Injector);

  /** The merchant the group was just linked to; the rule gives this merchant. */
  readonly merchant: InputSignal<Merchant> = input.required<Merchant>();
  /** The descriptions just linked, checked against the merchant's rules. */
  readonly descriptions: InputSignal<string[]> = input.required<string[]>();

  /** The rule was created (and applied, when asked): the host moves on. */
  readonly created: OutputEmitterRef<void> = output<void>();
  /** Skip, Escape, or OK on "already covered": the host moves on without a rule. */
  readonly skip: OutputEmitterRef<void> = output<void>();

  /** The merchant's rules' coverage of the descriptions; null while asking, or when that failed. */
  readonly coverage: WritableSignal<MerchantRuleCoverage | null> = signal(null);
  readonly coverageLoading: WritableSignal<boolean> = signal(true);
  /** Whether the shared rule fields are open for editing. */
  readonly editing: WritableSignal<boolean> = signal(false);
  /** Whether creating should also fill the blank transactions the rule matches. */
  readonly fillBlanks: WritableSignal<boolean> = signal(false);
  readonly creating: WritableSignal<boolean> = signal(false);

  private destroyed = false;
  private readonly draft: WritableSignal<MerchantRuleDraft | null> = signal(null);
  private readonly previewState: WritableSignal<PreviewState> = signal({ kind: 'idle' });
  private readonly drafts$: Subject<MerchantRuleDraft | null> = new Subject();
  private readonly card: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild<ElementRef<HTMLElement>>('card');

  /** True when the merchant's rules already win every description, so no rule is offered. */
  readonly covered: Signal<boolean> = computed((): boolean => {
    const c: MerchantRuleCoverage | null = this.coverage();
    if (!c) return false;
    const won = new Set<string>(c.coveredDescriptions);
    return this.descriptions().every((d: string): boolean => won.has(d));
  });

  /** The rules that already cover the descriptions, for the "already covers" line. */
  readonly coveringRules: Signal<MerchantRuleRef[]> = computed(
    (): MerchantRuleRef[] => this.coverage()?.rules ?? [],
  );

  /** The keywords as drafted, for the card's title; empty while the box is. */
  readonly keywords: Signal<string[]> = computed((): string[] => this.draft()?.keywords ?? []);

  readonly previewLoading: Signal<boolean> = computed(
    (): boolean => this.previewState().kind === 'loading',
  );
  readonly previewFailed: Signal<boolean> = computed(
    (): boolean => this.previewState().kind === 'error',
  );

  /** The preview of the current draft, or null while there is none for it. */
  readonly preview: Signal<MerchantRuleMatchPreview | null> = computed(
    (): MerchantRuleMatchPreview | null => {
      const state: PreviewState = this.previewState();
      return state.kind === 'ok' && state.key === JSON.stringify(this.draft())
        ? state.preview
        : null;
    },
  );

  /**
   * What the draft would match, in words: every transaction it matches, and how many blank ones it
   * would give the merchant (a blank one another rule wins is not counted).
   */
  readonly matchText: Signal<string> = computed((): string => {
    const p: MerchantRuleMatchPreview | null = this.preview();
    if (!p) return '';
    if (p.totalMatches === 0) return 'Matches no transactions yet.';
    const fills: string =
      p.willAssignCount === 0 ? 'no blank ones' : plural(p.willAssignCount, 'blank one');
    return `Matches ${plural(p.totalMatches, 'transaction')}; would fill ${fills}.`;
  });

  readonly overlapSentences: Signal<string[]> = computed((): string[] =>
    (this.preview()?.overlaps ?? []).map(overlapSentence),
  );

  /**
   * The blank transactions creating can fill: every one the draft would give the merchant, when the
   * preview lists them all (it carries up to the 2,000 one create-and-apply takes); otherwise none.
   */
  readonly fillIds: Signal<number[]> = computed((): number[] => {
    const p: MerchantRuleMatchPreview | null = this.preview();
    const ids: number[] = p?.willAssignIds ?? [];
    return p && p.willAssignCount > 0 && ids.length === p.willAssignCount ? ids : [];
  });

  /**
   * Whether Create may be pressed: not while saving, not before the coverage check has answered
   * (it may say a rule already exists), and not while a ticked "Also fill" waits for the preview of
   * the current draft (creating then would drop the fill without a word).
   */
  readonly canCreate: Signal<boolean> = computed(
    (): boolean =>
      !this.creating() &&
      !this.coverageLoading() &&
      !this.covered() &&
      !(this.fillBlanks() && this.previewLoading()),
  );

  readonly fillLabel: Signal<string> = computed(
    (): string => `Also fill ${plural(this.fillIds().length, 'blank transaction')}`,
  );

  constructor() {
    super();
    this.destroyRef.onDestroy((): void => {
      this.destroyed = true;
    });
    this.draftChange.subscribe((draft: MerchantRuleDraft | null): void => {
      this.draft.set(draft);
      this.drafts$.next(draft);
    });
    this.drafts$
      .pipe(
        tap((draft: MerchantRuleDraft | null): void =>
          this.previewState.set(draft ? { kind: 'loading' } : { kind: 'idle' }),
        ),
        debounceTime(PREVIEW_DEBOUNCE_MS),
        switchMap((draft: MerchantRuleDraft | null): Observable<PreviewState> => {
          if (!draft) return of<PreviewState>({ kind: 'idle' });
          return this.ruleApi.previewMatches(draft).pipe(
            map((preview: MerchantRuleMatchPreview): PreviewState => ({
              kind: 'ok',
              key: JSON.stringify(draft),
              preview,
            })),
            catchError((): Observable<PreviewState> => of<PreviewState>({ kind: 'error' })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((state: PreviewState): void => this.previewState.set(state));
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.ruleApi
      .coverage(this.merchant().id, this.descriptions())
      .pipe(
        // the check only advises: when it fails, the rule is offered as usual
        catchError((): Observable<MerchantRuleCoverage | null> => of(null)),
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.coverageLoading.set(false)),
      )
      .subscribe((coverage: MerchantRuleCoverage | null): void => this.coverage.set(coverage));
  }

  protected buildForm(): OfferForm {
    return createRuleForm({});
  }

  protected targetKey(): unknown {
    return null;
  }

  protected targetValue(): Record<string, unknown> {
    return {};
  }

  protected override draftExtras(): Partial<MerchantRuleDraft> {
    return { merchantId: this.merchant().id };
  }

  /** The drafted keywords as the title shows them. */
  protected keywordsText(): string {
    return keywordsLabel(this.keywords());
  }

  /** A covering rule's keywords as the "already covers" line shows them. */
  protected ruleKeywords(rule: MerchantRuleRef): string {
    return keywordsLabel(rule.keywords);
  }

  /** Moves focus to the card, so Enter creates and Escape skips (the host calls this). */
  focus(): void {
    this.card()?.nativeElement.focus();
  }

  /** Opens the rule fields, with focus in the keywords. */
  edit(): void {
    this.editing.set(true);
    afterNextRender({ read: (): void => this.focusKeywords() }, { injector: this.injector });
  }

  /** Enter on the card itself (not on a button or field inside it) acts as its first choice. */
  onCardKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.skip.emit();
      return;
    }
    if (event.key === 'Enter' && event.target === event.currentTarget) {
      event.preventDefault();
      if (this.coverageLoading()) return;
      if (this.covered()) this.skip.emit();
      else this.submit();
    }
  }

  /**
   * Creates the rule for the merchant, and fills the blank transactions it matches when asked. An
   * invalid draft opens the fields so the messages show; a refusal is shown on the card.
   */
  submit(): void {
    if (!this.canCreate()) return;
    if (!this.prepareSubmit()) {
      this.edit();
      return;
    }
    const rule = { ...this.commonValue(), merchantId: this.merchant().id };
    const ids: number[] = this.fillBlanks() ? this.fillIds() : [];
    const label = `${keywordsLabel(rule.keywords)} → ${this.merchant().name}`;
    this.creating.set(true);
    const request$: Observable<unknown> =
      ids.length > 0
        ? this.ruleApi.createAndApply({ rule, transactionIds: ids })
        : this.ruleApi.createRule(rule);
    // not cut short when the card closes meanwhile (a new link, Undo): the server may already have
    // the rule, so the toast still says what happened
    request$.pipe(finalize((): void => this.creating.set(false))).subscribe({
      next: (): void => {
        const filled: string =
          ids.length > 0 ? `, filled ${plural(ids.length, 'transaction')}` : '';
        this.toast.success('Rule created', `${label}${filled}`);
        if (!this.destroyed) this.created.emit();
      },
      error: (err: HttpErrorResponse): void => {
        if (this.destroyed) this.toast.error(err.error?.detail || 'Failed to create the rule.');
        else this.errorMessage.set(err.error?.detail || 'Failed to create the rule.');
      },
    });
  }
}
