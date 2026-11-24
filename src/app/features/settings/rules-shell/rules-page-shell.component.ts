import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  Signal,
  viewChild,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { SidePanelComponent } from '@shared/components/side-panel/side-panel.component';

export type RulePanelMode = 'overview' | 'rule' | 'add';

/**
 * The page frame the Category rules and Merchant rules sections share: toolbar, load states, search,
 * the empty and no-match states and the always-present side panel with its overview. The sections
 * project the row list (`[rows]`) and the panel body for an open or new rule (`[panel]`), and own
 * everything about loading, saving and the rules themselves, so the two cannot drift apart.
 */
@Component({
  selector: 'app-rules-page-shell',
  standalone: true,
  imports: [
    ButtonModule,
    SkeletonModule,
    ScreenToolbarComponent,
    SidePanelComponent,
    PageErrorStateComponent,
  ],
  templateUrl: './rules-page-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RulesPageShellComponent {
  /** The section name, e.g. "Category rules". */
  readonly heading: InputSignal<string> = input.required<string>();
  /** The lower-case section name, e.g. "category rules", for status and error text. */
  readonly nounText: InputSignal<string> = input.required<string>();
  readonly emptyText: InputSignal<string> = input.required<string>();
  readonly overviewText: InputSignal<string> = input.required<string>();

  readonly rulesCount: InputSignal<number> = input.required<number>();
  readonly visibleCount: InputSignal<number> = input.required<number>();
  readonly loading: InputSignal<boolean> = input.required<boolean>();
  readonly loadedOnce: InputSignal<boolean> = input.required<boolean>();
  readonly loadError: InputSignal<boolean> = input.required<boolean>();
  readonly applying: InputSignal<boolean> = input.required<boolean>();
  readonly saving: InputSignal<boolean> = input.required<boolean>();
  readonly panelMode: InputSignal<RulePanelMode> = input.required<RulePanelMode>();
  readonly panelTitle: InputSignal<string> = input.required<string>();
  readonly onlyAddMode: InputSignal<boolean> = input.required<boolean>();
  readonly search: ModelSignal<string> = model.required<string>();

  readonly add: OutputEmitterRef<void> = output<void>();
  readonly apply: OutputEmitterRef<void> = output<void>();
  readonly retry: OutputEmitterRef<void> = output<void>();
  readonly panelSave: OutputEmitterRef<void> = output<void>();
  readonly panelClose: OutputEmitterRef<void> = output<void>();

  private readonly panel = viewChild(SidePanelComponent);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly fullError: Signal<boolean> = computed(
    (): boolean => this.loadError() && this.rulesCount() === 0 && this.panelMode() === 'overview',
  );
  protected readonly showSkeleton: Signal<boolean> = computed(
    (): boolean => this.loading() && !this.loadedOnce(),
  );
  protected readonly inPanel: Signal<boolean> = computed(
    (): boolean => this.panelMode() !== 'overview' && !this.onlyAddMode(),
  );
  /** Read out when the search narrows the list; silent while the search is empty. */
  protected readonly searchStatus: Signal<string> = computed((): string => {
    if (!this.search().trim()) return '';
    const n: number = this.visibleCount();
    return n === 0 ? 'No rules match' : `${n} ${n === 1 ? 'rule matches' : 'rules match'}`;
  });

  /** Moves focus to the panel; the section calls this on a mode change. */
  focusPanel(): void {
    this.panel()?.focus();
  }

  protected clearSearch(): void {
    this.search.set('');
    this.searchInput()?.nativeElement.focus();
  }
}
