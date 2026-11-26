import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  OnInit,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  viewChildren,
  WritableSignal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  concat,
  debounceTime,
  finalize,
  map,
  Observable,
  of,
  Subject,
  Subscription,
  toArray,
} from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import {
  DescriptionGroup,
  DescriptionGroupPage,
  Merchant,
  MerchantSuggestion,
  TransactionDescription,
} from '@models/merchant.model';
import { TransactionApiService } from '@features/transactions/services/transaction-api.service';
import { ToastService } from '@core/services/toast.service';
import { MerchantApiService } from '../../services/merchant-api.service';
import { BULK_LINK_LIMIT, chunk } from '../../utils/merchant-helpers';
import { MerchantComboboxComponent } from '../merchant-combobox/merchant-combobox.component';

/** How many groups load at first, and how many more each "Show more" adds. */
export const GROUP_PAGE_SIZE = 25;
const SUGGESTION_LIMIT = 5;
/** The suggestions endpoint takes at most this many names at once. */
const SUGGESTION_BATCH = 100;
const SEARCH_DEBOUNCE_MS = 300;

/** What the host is asked to do when "Create" is chosen for a group. */
export interface CreateForGroup {
  key: string;
  name: string;
}

/** One request's worth of linking: the descriptions sent, and whether it worked. */
interface LinkOutcome {
  items: string[];
  ok: boolean;
  message: string;
}

/**
 * The Unlinked tab: the user's unlinked descriptions grouped into likely merchants, each with a
 * merchant field to link the whole group in one go. Built to be worked through from the keyboard:
 * the arrow keys move between groups and open them, typing goes to the merchant field, Enter links
 * and moves on to the next group, and Escape comes back to the row.
 *
 * Linked groups leave the list in place rather than reloading it, so the list keeps its place.
 * "Show more" reloads from the top with a bigger page for the same reason: paging on from an offset
 * would skip as many groups as were linked meanwhile.
 */
@Component({
  selector: 'app-unlinked-groups',
  standalone: true,
  imports: [NgTemplateOutlet, SkeletonModule, MerchantComboboxComponent],
  templateUrl: './unlinked-groups.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnlinkedGroupsComponent implements OnInit {
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly injector: Injector = inject(Injector);

  /** Something was linked: the host refreshes what depends on links. */
  readonly linked: OutputEmitterRef<void> = output<void>();
  /** How many descriptions are still unlinked in all, after every load and link. */
  readonly unlinkedCountChange: OutputEmitterRef<number> = output<number>();
  /** "Create" was chosen in a group's merchant field. */
  readonly createMerchant: OutputEmitterRef<CreateForGroup> = output<CreateForGroup>();

  readonly groups: WritableSignal<DescriptionGroup[]> = signal([]);
  readonly total: WritableSignal<number> = signal(0);
  readonly search: WritableSignal<string> = signal('');
  readonly loading: WritableSignal<boolean> = signal(false);
  readonly loadFailed: WritableSignal<boolean> = signal(false);
  readonly loadedOnce: WritableSignal<boolean> = signal(false);
  /** The search the shown groups were loaded for. */
  readonly dataSearch: WritableSignal<string> = signal('');
  readonly expanded: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set());
  /** Variants the user unticked, by group key; every other variant is ticked. */
  readonly unticked: WritableSignal<ReadonlyMap<string, ReadonlySet<string>>> = signal(new Map());
  /** Suggested merchants by group name. */
  readonly suggestions: WritableSignal<ReadonlyMap<string, Merchant[]>> = signal(new Map());
  /** Groups whose link is in flight. */
  readonly linking: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set());
  /** The group whose row takes Tab (roving focus). */
  readonly activeKey: WritableSignal<string | null> = signal<string | null>(null);

  readonly canShowMore: Signal<boolean> = computed(
    (): boolean => this.groups().length < this.total(),
  );
  readonly progressText: Signal<string> = computed((): string => {
    const shown: number = this.groups().length;
    return shown === 1
      ? `1 of ${this.total()} groups shown`
      : `${shown} of ${this.total()} groups shown`;
  });
  /** Display names by key, for naming the look-alike groups. */
  private readonly namesByKey: Signal<ReadonlyMap<string, string>> = computed(
    (): ReadonlyMap<string, string> =>
      new Map(this.groups().map((g: DescriptionGroup): [string, string] => [g.key, g.displayName])),
  );

  private readonly rows = viewChildren<ElementRef<HTMLElement>>('row');
  private readonly comboboxes = viewChildren(MerchantComboboxComponent);

  private size: number = GROUP_PAGE_SIZE;
  /** Descriptions still unlinked in all, as last loaded and less what was linked since. */
  private unlinkedCount = 0;
  private loadSubscription: Subscription | null = null;
  private loadRun = 0;
  /** The variant last clicked in each group, for shift-click ranges. */
  private readonly lastClicked = new Map<string, number>();
  private readonly search$: Subject<string> = new Subject<string>();

  constructor() {
    this.search$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((): void => {
        this.size = GROUP_PAGE_SIZE;
        this.load();
      });
  }

  ngOnInit(): void {
    this.load();
  }

  /** Loads the groups from the top, as many as are shown; a newer load replaces an older one. */
  load(): void {
    this.loadSubscription?.unsubscribe();
    const run: number = ++this.loadRun;
    const term: string = this.search().trim();
    this.loading.set(true);
    this.loadFailed.set(false);
    this.loadSubscription = this.transactionApi
      .getDescriptionGroups({ search: term, unlinkedOnly: true, page: 0, size: this.size })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => {
          if (run === this.loadRun) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (page: DescriptionGroupPage): void => {
          this.groups.set(page.content);
          this.total.set(page.page.totalElements);
          this.dataSearch.set(term);
          this.loadedOnce.set(true);
          this.unlinkedCount = page.unlinkedDescriptionCount;
          this.unlinkedCountChange.emit(this.unlinkedCount);
          const active: string | null = this.activeKey();
          if (!page.content.some((g: DescriptionGroup): boolean => g.key === active)) {
            this.activeKey.set(page.content[0]?.key ?? null);
          }
          this.loadSuggestions(page.content);
        },
        error: (err: unknown): void => {
          console.error('Failed to load description groups:', err);
          if (run === this.loadRun) this.loadFailed.set(true);
        },
      });
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.search$.next(value);
  }

  showMore(): void {
    if (this.loading() || !this.canShowMore()) return;
    this.size = this.groups().length + GROUP_PAGE_SIZE;
    this.load();
  }

  isExpanded(group: DescriptionGroup): boolean {
    return this.expanded().has(group.key);
  }

  setExpanded(group: DescriptionGroup, open: boolean): void {
    const next: Set<string> = new Set<string>(this.expanded());
    if (open) next.add(group.key);
    else next.delete(group.key);
    this.expanded.set(next);
  }

  isTicked(group: DescriptionGroup, variant: TransactionDescription): boolean {
    return !this.unticked().get(group.key)?.has(variant.description);
  }

  tickedVariants(group: DescriptionGroup): TransactionDescription[] {
    return group.variants.filter((v: TransactionDescription): boolean => this.isTicked(group, v));
  }

  /** Ticks or unticks one variant; with Shift held, every variant from the last one clicked too. */
  onVariantClick(group: DescriptionGroup, index: number, event: MouseEvent): void {
    const variant: TransactionDescription = group.variants[index];
    const tick = !this.isTicked(group, variant);
    const last: number | undefined = this.lastClicked.get(group.key);
    const [from, to] =
      event.shiftKey && last !== undefined
        ? [Math.min(last, index), Math.max(last, index)]
        : [index, index];
    const off: Set<string> = new Set<string>(this.unticked().get(group.key) ?? []);
    group.variants.slice(from, to + 1).forEach((v: TransactionDescription): void => {
      if (tick) off.delete(v.description);
      else off.add(v.description);
    });
    this.lastClicked.set(group.key, index);
    this.setUnticked(group.key, off);
  }

  /** Stops a shift-click from also selecting the page's text. */
  onVariantMousedown(event: MouseEvent): void {
    if (event.shiftKey) event.preventDefault();
  }

  suggestionsFor(group: DescriptionGroup): Merchant[] {
    return this.suggestions().get(group.displayName) ?? [];
  }

  /** The names of the loaded groups that look like this one, falling back to their keys. */
  similarNames(group: DescriptionGroup): string {
    return group.similarKeys
      .map((key: string): string => this.namesByKey().get(key) ?? key)
      .join(', ');
  }

  isLinking(group: DescriptionGroup): boolean {
    return this.linking().has(group.key);
  }

  usage(count: number): string {
    return count === 1 ? '1 transaction' : `${count} transactions`;
  }

  variantsLabel(count: number): string {
    return count === 1 ? '1 variant' : `${count} variants`;
  }

  comboId(index: number): string {
    return `unlinked-merchant-${index}`;
  }

  /** The keys a row answers to, when the row itself (not a control inside it) has focus. */
  onRowKeydown(event: KeyboardEvent, index: number): void {
    if (event.target !== event.currentTarget) return;
    const group: DescriptionGroup = this.groups()[index];
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusRow(Math.min(index + 1, this.groups().length - 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.focusRow(Math.max(index - 1, 0));
        return;
      case 'Home':
        event.preventDefault();
        this.focusRow(0);
        return;
      case 'End':
        event.preventDefault();
        this.focusRow(this.groups().length - 1);
        return;
      case 'ArrowRight':
        event.preventDefault();
        this.setExpanded(group, true);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        this.setExpanded(group, false);
        return;
      case 'Enter':
        event.preventDefault();
        this.comboboxes()[index]?.focus();
        return;
    }
    if (
      event.key.length === 1 &&
      event.key !== ' ' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      // typing a name goes straight to the merchant field
      event.preventDefault();
      this.comboboxes()[index]?.focus(event.key);
    }
  }

  focusRow(index: number): void {
    const group: DescriptionGroup | undefined = this.groups()[index];
    if (!group) return;
    this.activeKey.set(group.key);
    this.rows()[index]?.nativeElement.focus();
  }

  /** Escape in a group's merchant field hands focus back to its row. */
  backToRow(group: DescriptionGroup): void {
    const index: number = this.groups().indexOf(group);
    if (index >= 0) this.focusRow(index);
  }

  onCreate(group: DescriptionGroup, name: string): void {
    this.createMerchant.emit({ key: group.key, name });
  }

  /**
   * The host created a merchant for a group: it is offered first in that group's field, with focus
   * there, so Enter links the group to it.
   */
  merchantCreated(key: string, merchant: Merchant): void {
    const group: DescriptionGroup | undefined = this.groups().find(
      (g: DescriptionGroup): boolean => g.key === key,
    );
    if (!group) return;
    const next = new Map<string, Merchant[]>(this.suggestions());
    next.set(group.displayName, [merchant, ...this.suggestionsFor(group)]);
    this.suggestions.set(next);
    afterNextRender(
      (): void => {
        const index: number = this.groups().indexOf(group);
        if (index < 0) return;
        this.activeKey.set(group.key);
        this.comboboxes()[index]?.offer(merchant);
      },
      { injector: this.injector },
    );
  }

  /**
   * Links a group's ticked variants to the merchant, in requests of at most 500. Linked variants
   * leave the group, and a group with none left leaves the list, with focus moving on to the next
   * one. Variants that failed stay in the group, still ticked.
   */
  linkGroup(group: DescriptionGroup, merchant: Merchant): void {
    if (this.isLinking(group)) return;
    const descriptions: string[] = this.tickedVariants(group).map(
      (v: TransactionDescription): string => v.description,
    );
    if (descriptions.length === 0) {
      this.toast.error('Tick at least one description to link.');
      return;
    }
    this.setLinking(group.key, true);
    const focusAtStart: Element | null = document.activeElement;

    const send = (items: string[]): Observable<LinkOutcome> =>
      this.merchantApi.addDescriptionLinks(merchant.id, items).pipe(
        map((): LinkOutcome => ({ items, ok: true, message: '' })),
        catchError((error: HttpErrorResponse) =>
          of({ items, ok: false, message: error.error?.detail || 'Failed to link descriptions' }),
        ),
      );

    concat(...chunk(descriptions, BULK_LINK_LIMIT).map(send))
      .pipe(
        toArray(),
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.setLinking(group.key, false)),
      )
      .subscribe((outcomes: LinkOutcome[]): void =>
        this.afterLink(group, merchant, outcomes, focusAtStart),
      );
  }

  /**
   * Applies a finished link. A load that was in flight started before the link and would bring the
   * linked group and the old count back, so it is replaced by a fresh one.
   */
  private afterLink(
    group: DescriptionGroup,
    merchant: Merchant,
    outcomes: LinkOutcome[],
    focusAtStart: Element | null,
  ): void {
    const done = new Set<string>(
      outcomes.filter((o: LinkOutcome): boolean => o.ok).flatMap((o: LinkOutcome) => o.items),
    );
    const failed: LinkOutcome[] = outcomes.filter((o: LinkOutcome): boolean => !o.ok);
    const failedCount: number = failed.reduce((n: number, o: LinkOutcome) => n + o.items.length, 0);

    if (done.size > 0) {
      this.linked.emit();
      this.removeVariants(group, done, focusAtStart);
      if (this.loading()) this.load();
    }
    if (failed.length === 0) {
      this.toast.success(
        `Linked ${done.size} ${done.size === 1 ? 'description' : 'descriptions'} to ${merchant.name}`,
      );
      return;
    }
    this.toast.error(`Linked ${done.size}, ${failedCount} failed: ${failed[0].message}`);
  }

  /** Takes linked variants out of a group (and the group out of the list once it is empty). */
  private removeVariants(
    group: DescriptionGroup,
    done: ReadonlySet<string>,
    focusAtStart: Element | null,
  ): void {
    const list: DescriptionGroup[] = this.groups();
    const index: number = list.findIndex((g: DescriptionGroup): boolean => g.key === group.key);
    if (index < 0) return;
    const current: DescriptionGroup = list[index];
    const left: TransactionDescription[] = current.variants.filter(
      (v: TransactionDescription): boolean => !done.has(v.description),
    );
    // indexes shift once variants leave, so a shift-click range starts afresh
    this.lastClicked.delete(group.key);
    this.unlinkedCount = Math.max(this.unlinkedCount - done.size, 0);
    this.unlinkedCountChange.emit(this.unlinkedCount);

    if (left.length > 0) {
      const next: DescriptionGroup[] = [...list];
      next[index] = {
        ...current,
        variants: left,
        variantCount: left.length,
        transactionCount: left.reduce(
          (n: number, v: TransactionDescription) => n + v.transactionCount,
          0,
        ),
      };
      this.groups.set(next);
      this.backToRowAfterRender(current.key, focusAtStart);
      return;
    }

    const next: DescriptionGroup[] = list.filter((_, i: number): boolean => i !== index);
    this.groups.set(next);
    this.total.update((t: number): number => Math.max(t - 1, 0));
    this.expanded.update((keys: ReadonlySet<string>): ReadonlySet<string> => {
      const copy = new Set<string>(keys);
      copy.delete(group.key);
      return copy;
    });
    const following: DescriptionGroup | undefined = next[index] ?? next[index - 1];
    this.activeKey.set(following?.key ?? null);
    if (following) this.backToRowAfterRender(following.key, focusAtStart);
  }

  /**
   * Focuses a row once it has rendered, unless the user moved focus elsewhere while the link ran:
   * focus still where it was, or dropped to the page because its row left, means it is ours to move.
   */
  private backToRowAfterRender(key: string, focusAtStart: Element | null): void {
    afterNextRender(
      (): void => {
        const now: Element | null = document.activeElement;
        if (now !== focusAtStart && now !== null && now !== document.body) return;
        const index: number = this.groups().findIndex(
          (g: DescriptionGroup): boolean => g.key === key,
        );
        if (index >= 0) this.focusRow(index);
      },
      { injector: this.injector },
    );
  }

  /** Asks for merchant suggestions for any loaded group name that has none yet. */
  private loadSuggestions(groups: DescriptionGroup[]): void {
    const known: ReadonlyMap<string, Merchant[]> = this.suggestions();
    const names: string[] = [
      ...new Set(groups.map((g: DescriptionGroup): string => g.displayName)),
    ].filter((name: string): boolean => !known.has(name));
    chunk(names, SUGGESTION_BATCH).forEach((batch: string[]): void => {
      this.merchantApi
        .suggestMerchants(batch, SUGGESTION_LIMIT)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (found: MerchantSuggestion[]): void => {
            const next = new Map<string, Merchant[]>(this.suggestions());
            found.forEach((s: MerchantSuggestion): void => {
              next.set(s.name, s.merchants);
            });
            this.suggestions.set(next);
          },
          // without suggestions the field still searches every merchant and offers Create
          error: (err: unknown): void => console.error('Failed to load merchant suggestions:', err),
        });
    });
  }

  private setUnticked(key: string, off: ReadonlySet<string>): void {
    const next = new Map<string, ReadonlySet<string>>(this.unticked());
    next.set(key, off);
    this.unticked.set(next);
  }

  private setLinking(key: string, on: boolean): void {
    const next = new Set<string>(this.linking());
    if (on) next.add(key);
    else next.delete(key);
    this.linking.set(next);
  }
}
