import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, of, Subject, switchMap } from 'rxjs';
import { Merchant } from '@models/merchant.model';
import {
  merchantOptions,
  NEW_MERCHANT_ID,
} from '@features/settings/merchant-rules/utils/merchant-options';
import { MerchantApiService } from '../../services/merchant-api.service';
import { locationLabel, NO_LOCATION } from '../../utils/merchant-helpers';

const SEARCH_DEBOUNCE_MS = 250;

/**
 * How well a merchant name fits what was typed: 0 when it starts with it, 1 when one of its words
 * does, 2 when it only contains it somewhere.
 */
function fit(name: string, typed: string): number {
  const lower: string = name.toLowerCase();
  if (lower.startsWith(typed)) return 0;
  return lower.split(/[^\p{L}\p{N}]+/u).some((word: string): boolean => word.startsWith(typed))
    ? 1
    : 2;
}

/** The merchants in order of fit to what was typed, keeping their order otherwise. */
export function byFit(merchants: Merchant[], typed: string): Merchant[] {
  const term: string = typed.trim().toLowerCase();
  return merchants
    .map((m: Merchant, i: number) => ({ m, i, f: fit(m.name, term) }))
    .sort((a, b): number => a.f - b.f || a.i - b.i)
    .map(({ m }): Merchant => m);
}
/** The search asks for more than it shows, so the best fits can be picked from a wider set. */
const SEARCH_SIZE = 50;
const SHOWN_RESULTS = 8;

/**
 * A merchant field that commits on Enter, for working through a list one row at a time. Opened
 * empty it offers the given suggestions, best first; typing searches all merchants. A "Create"
 * option is offered when no merchant has the typed name (or, with nothing typed, the row's own
 * name), the same way the other merchant fields offer it.
 *
 * It is not the PrimeNG select the other merchant fields use: that select keeps its own focus in
 * an overlay, so Enter could not both choose and move on, and Escape could not hand focus back to
 * the row the field sits in.
 */
@Component({
  selector: 'app-merchant-combobox',
  standalone: true,
  templateUrl: './merchant-combobox.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantComboboxComponent {
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** A unique id for the field; the list and its options are named after it. */
  readonly comboId: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<string> = input.required<string>();
  /** Merchants to offer before anything is typed, best first. */
  readonly suggestions: InputSignal<Merchant[]> = input<Merchant[]>([]);
  /** The name the Create option offers when nothing is typed. */
  readonly createName: InputSignal<string> = input<string>('');
  readonly disabled: InputSignal<boolean> = input<boolean>(false);

  /** A merchant was chosen (Enter or click). */
  readonly pick: OutputEmitterRef<Merchant> = output<Merchant>();
  /** "Create" was chosen, with the name to create. */
  readonly create: OutputEmitterRef<string> = output<string>();
  /** Escape: the host should take focus back. */
  readonly escape: OutputEmitterRef<void> = output<void>();

  readonly text: WritableSignal<string> = signal('');
  readonly open: WritableSignal<boolean> = signal(false);
  readonly active: WritableSignal<number> = signal(0);
  /** Merchants found for the typed text; null while that search is pending. */
  private readonly results: WritableSignal<Merchant[] | null> = signal<Merchant[] | null>(null);

  readonly options: Signal<Merchant[]> = computed((): Merchant[] => {
    const typed: string = this.text().trim();
    if (typed === '') return merchantOptions(this.suggestions(), this.createName(), true);
    const found: Merchant[] =
      this.results() ??
      this.suggestions().filter((m: Merchant): boolean =>
        m.name.toLowerCase().includes(typed.toLowerCase()),
      );
    return merchantOptions(byFit(found, typed).slice(0, SHOWN_RESULTS), typed, true);
  });
  readonly activeId: Signal<string | null> = computed((): string | null =>
    this.open() && this.options().length > 0 ? this.optionId(this.active()) : null,
  );

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly search$: Subject<string> = new Subject<string>();

  readonly newMerchantId: number = NEW_MERCHANT_ID;

  constructor() {
    this.search$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        switchMap((term: string) =>
          term === ''
            ? of(null)
            : this.merchantApi.getMerchants(term, { page: 0, size: SEARCH_SIZE }).pipe(
                map((page): Merchant[] => page.content),
                // a failed search keeps offering the matching suggestions and Create
                catchError(() => of(null)),
              ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((found: Merchant[] | null): void => {
        this.results.set(found);
        this.active.set(0);
      });
  }

  listId(): string {
    return `${this.comboId()}-list`;
  }

  optionId(index: number): string {
    return `${this.comboId()}-option-${index}`;
  }

  location(merchant: Merchant): string | null {
    const label: string = locationLabel(merchant);
    return label === NO_LOCATION ? null : label;
  }

  /** Moves focus into the field, optionally starting the search with a typed character. */
  focus(typed = ''): void {
    if (typed !== '') this.setText(typed);
    this.input().nativeElement.focus();
    this.openList();
  }

  /** Focuses the field with this merchant first in the list, so Enter chooses it. */
  offer(merchant: Merchant): void {
    this.text.set(merchant.name);
    this.results.set([merchant]);
    this.input().nativeElement.focus();
    this.openList();
  }

  onInput(value: string): void {
    this.setText(value);
    this.openList();
  }

  onKeydown(event: KeyboardEvent): void {
    const count: number = this.options().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) this.openList();
        else this.active.set(Math.min(this.active() + 1, count - 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(Math.max(this.active() - 1, 0));
        return;
      case 'Enter': {
        event.preventDefault();
        const option: Merchant | undefined = this.options()[this.active()];
        if (this.open() && option) this.commit(option);
        else this.openList();
        return;
      }
      case 'Escape':
        event.preventDefault();
        // the row's keys must not see this escape too
        event.stopPropagation();
        this.close();
        this.escape.emit();
        return;
      case 'Tab':
        this.close();
        return;
    }
  }

  commit(option: Merchant): void {
    if (this.disabled()) return;
    this.close();
    this.setText('');
    if (option.id === NEW_MERCHANT_ID) this.create.emit(option.name);
    else this.pick.emit(option);
  }

  close(): void {
    this.open.set(false);
  }

  private openList(): void {
    if (this.disabled()) return;
    this.active.set(0);
    this.open.set(true);
  }

  private setText(value: string): void {
    this.text.set(value);
    this.results.set(null);
    this.active.set(0);
    this.search$.next(value.trim());
  }
}
