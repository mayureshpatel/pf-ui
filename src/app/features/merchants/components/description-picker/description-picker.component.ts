import { NgTemplateOutlet } from '@angular/common';
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
  linkedSignal,
  output,
  OutputEmitterRef,
  signal,
  Signal,
  untracked,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { DescriptionGroup, LookAlikeWarning, TransactionDescription } from '@models/merchant.model';
import { isMovingLink } from '../../utils/merchant-helpers';
import { LinkGuardComponent } from '../link-guard/link-guard.component';

/**
 * The panel's link-descriptions mode: a searchable list of the user's description groups, each
 * with a "Select group" box over its raw variants, to tick and link to one merchant. It loads
 * nothing itself; the host feeds it groups and reacts to search, toggle, show-more and link. Ticks
 * are kept here by description text so they survive new pages, searches and the Unlinked only
 * toggle. Before a link the host checks for look-alikes; when it hands back warnings the guard
 * takes the place of the Link button until the user decides.
 */
@Component({
  selector: 'app-description-picker',
  standalone: true,
  imports: [NgTemplateOutlet, LinkGuardComponent],
  templateUrl: './description-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DescriptionPickerComponent {
  readonly targetName: InputSignal<string> = input.required<string>();
  readonly targetId: InputSignal<number | null> = input.required<number | null>();
  readonly groups: InputSignal<DescriptionGroup[]> = input.required<DescriptionGroup[]>();
  /** How many groups match in all (the page shows the first of them). */
  readonly totalRecords: InputSignal<number> = input.required<number>();
  readonly loading: InputSignal<boolean> = input<boolean>(false);
  readonly linking: InputSignal<boolean> = input<boolean>(false);
  /** Descriptions whose link just failed: they stay ticked and every other tick is cleared. */
  readonly failed: InputSignal<string[]> = input<string[]>([]);
  readonly initialUnlinkedOnly: InputSignal<boolean> = input<boolean>(false);
  /** How many descriptions in all are still not linked to any merchant, when known. */
  readonly unlinkedLeft: InputSignal<number | null> = input<number | null>(null);
  /** True when the last load of rows failed, so an empty list is not read as "nothing left". */
  readonly loadFailed: InputSignal<boolean> = input<boolean>(false);
  /** False when Back lands on the overview (no merchant was open), so the label says so. */
  readonly backToTarget: InputSignal<boolean> = input<boolean>(true);
  /** Look-alike warnings for the link just asked for; empty when there is nothing to decide. */
  readonly warnings: InputSignal<LookAlikeWarning[]> = input<LookAlikeWarning[]>([]);

  readonly searchChange: OutputEmitterRef<string> = output<string>();
  readonly unlinkedOnlyChange: OutputEmitterRef<boolean> = output<boolean>();
  readonly showMore: OutputEmitterRef<void> = output<void>();
  /** Asks to link the ticked descriptions; the host checks them for look-alikes first. */
  readonly link: OutputEmitterRef<string[]> = output<string[]>();
  /** The guard's decision: link these, already checked. */
  readonly linkChecked: OutputEmitterRef<string[]> = output<string[]>();
  /** The guard was cancelled, or the ticks it was about changed. */
  readonly warningsDismissed: OutputEmitterRef<void> = output<void>();
  /** Emits when the user goes back to the merchant (named so it is not a DOM event like cancel). */
  readonly back: OutputEmitterRef<void> = output<void>();
  readonly retryLoad: OutputEmitterRef<void> = output<void>();

  readonly unlinkedOnly: WritableSignal<boolean> = linkedSignal((): boolean =>
    this.initialUnlinkedOnly(),
  );
  readonly search: WritableSignal<string> = signal('');
  readonly ticked: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set());
  private readonly injector: Injector = inject(Injector);
  private readonly linkButton = viewChild<ElementRef<HTMLButtonElement>>('linkButton');
  private readonly searchField = viewChild<ElementRef<HTMLInputElement>>('searchField');

  /** The descriptions the shown warnings are about, as they were ticked when Link was pressed. */
  readonly pending: WritableSignal<string[]> = signal<string[]>([]);

  readonly tickedCount: Signal<number> = computed((): number => this.ticked().size);
  readonly canShowMore: Signal<boolean> = computed(
    (): boolean => this.groups().length < this.totalRecords(),
  );
  readonly linkLabel: Signal<string> = computed((): string => {
    if (this.linking()) return 'Linking…';
    const count: number = this.tickedCount();
    if (count === 0) return 'Link descriptions';
    return count === 1 ? 'Link 1 description' : `Link ${count} descriptions`;
  });
  readonly guarding: Signal<boolean> = computed((): boolean => this.warnings().length > 0);
  /** Where the user is in the backlog: how many groups are shown, and how many are still unlinked. */
  readonly progressText: Signal<string> = computed((): string => {
    const parts: string[] = [];
    const shown: number = this.groups().length;
    if (shown > 0) parts.push(`${shown} of ${this.totalRecords()} groups shown`);
    const left: number | null = this.unlinkedLeft();
    if (left !== null) parts.push(`${left} not linked yet`);
    return parts.join(' · ');
  });
  readonly emptyMessage: Signal<string> = computed((): string =>
    this.unlinkedOnly() && this.search().trim() === ''
      ? 'Every description is linked.'
      : 'No descriptions match',
  );

  constructor() {
    effect((): void => {
      const failed: string[] = this.failed();
      if (failed.length === 0) return;
      untracked((): void => this.ticked.set(new Set(failed)));
    });
  }

  moving(row: TransactionDescription): boolean {
    return isMovingLink(row, this.targetId());
  }

  alreadyLinkedHere(row: TransactionDescription): boolean {
    return row.merchantId !== null && row.merchantId === this.targetId();
  }

  usage(row: TransactionDescription): string {
    return row.transactionCount === 1 ? '1 transaction' : `${row.transactionCount} transactions`;
  }

  groupUsage(group: DescriptionGroup): string {
    const variants: string =
      group.variantCount === 1 ? '1 description' : `${group.variantCount} descriptions`;
    const uses: string =
      group.transactionCount === 1 ? '1 transaction' : `${group.transactionCount} transactions`;
    return `${variants} · ${uses}`;
  }

  /** The group's variants that can be ticked: one already linked to this merchant has nothing to do. */
  selectable(group: DescriptionGroup): TransactionDescription[] {
    return group.variants.filter(
      (row: TransactionDescription): boolean => !this.alreadyLinkedHere(row),
    );
  }

  /** Whether every, some or none of a group's selectable variants are ticked. */
  groupState(group: DescriptionGroup): 'all' | 'some' | 'none' {
    const rows: TransactionDescription[] = this.selectable(group);
    const on: number = rows.filter((row: TransactionDescription): boolean =>
      this.ticked().has(row.description),
    ).length;
    if (on === 0) return 'none';
    return on === rows.length ? 'all' : 'some';
  }

  toggleTick(description: string): void {
    const next: Set<string> = new Set<string>(this.ticked());
    if (next.has(description)) next.delete(description);
    else next.add(description);
    this.setTicks(next);
  }

  /** Ticks every selectable variant of a group, or clears them when they all already are. */
  toggleGroup(group: DescriptionGroup): void {
    const next: Set<string> = new Set<string>(this.ticked());
    const tick: boolean = this.groupState(group) !== 'all';
    this.selectable(group).forEach((row: TransactionDescription): void => {
      if (tick) next.add(row.description);
      else next.delete(row.description);
    });
    this.setTicks(next);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.searchChange.emit(value);
  }

  toggleUnlinkedOnly(): void {
    const next = !this.unlinkedOnly();
    this.unlinkedOnly.set(next);
    this.unlinkedOnlyChange.emit(next);
  }

  submit(): void {
    if (this.tickedCount() === 0 || this.linking()) return;
    const descriptions: string[] = [...this.ticked()];
    this.pending.set(descriptions);
    this.link.emit(descriptions);
  }

  /** "Leave those out": the warned descriptions are unticked, and the rest linked if any are left. */
  onLeaveOut(remaining: string[]): void {
    this.ticked.set(new Set(remaining));
    if (remaining.length === 0) this.dismissGuard();
    else this.linkChecked.emit(remaining);
  }

  /** Cancels the guard and puts focus back where linking continues, since its buttons go away. */
  dismissGuard(): void {
    this.warningsDismissed.emit();
    afterNextRender(
      (): void => {
        const link: HTMLButtonElement | undefined = this.linkButton()?.nativeElement;
        if (link && !link.disabled) link.focus();
        else this.searchField()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  /** A tick change makes any shown warnings out of date, so they are dropped. */
  private setTicks(next: ReadonlySet<string>): void {
    this.ticked.set(next);
    if (this.guarding()) this.warningsDismissed.emit();
  }
}
