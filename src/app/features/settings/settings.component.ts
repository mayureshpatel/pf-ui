import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  ElementRef,
  Injector,
  inject,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, NavigationStart, Params, Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { AppearanceSettingsComponent } from './components/appearance-settings/appearance-settings.component';
import { SettingsNavComponent } from './components/settings-nav/settings-nav.component';
import { CategoryRulesComponent } from './category-rules/category-rules.component';
import { TagsComponent } from './tags/tags.component';
import { SettingsGuard } from './settings.guard';
import {
  SECTION_TITLES,
  SettingsSection,
  isKnownSection,
  MOVED_MERCHANT_RULES_SECTION,
  sectionFromParam,
} from './utils/settings-helpers';

/**
 * The Settings page: a section list (Appearance, Category rules, Tags) and the chosen section. The section
 * lives in the URL (`?section=`) so Back and Forward move between sections, and leaving a section that
 * holds unsaved changes asks first.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    ScreenToolbarComponent,
    SettingsNavComponent,
    AppearanceSettingsComponent,
    CategoryRulesComponent,
    TagsComponent,
  ],
  providers: [SettingsGuard],
  templateUrl: './settings.component.html',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly confirmation: ConfirmationService = inject(ConfirmationService);
  private readonly guard: SettingsGuard = inject(SettingsGuard);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly location: Location = inject(Location);
  private readonly title: Title = inject(Title);
  private readonly injector: Injector = inject(Injector);
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

  /** The id of the navigation that is on screen, to tell Back from Forward. */
  private currentNavigationId = 0;
  /** Which way the browser's last Back or Forward button moved, or null for anything else. */
  private lastPop: 'back' | 'forward' | null = null;

  readonly section: WritableSignal<SettingsSection> = signal(
    sectionFromParam(this.route.snapshot.queryParams['section']),
  );

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event): void => {
      if (event instanceof NavigationEnd) {
        this.currentNavigationId = event.id;
        this.setTitle();
      } else if (event instanceof NavigationStart) {
        const restored: number | undefined = event.restoredState?.navigationId;
        this.lastPop =
          event.navigationTrigger === 'popstate' && restored !== undefined
            ? restored < this.currentNavigationId
              ? 'back'
              : 'forward'
            : null;
      }
    });
    if (this.sendMovedSection(this.route.snapshot.queryParams['section'])) return;
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => this.followUrl(params));
    this.normaliseUrl(this.route.snapshot.queryParams['section']);
    this.setTitle();
  }

  /**
   * Merchant rules moved to the Merchants page: an old `?section=merchant-rules` link goes there,
   * without leaving the old address in the history.
   * @returns true when it sent the user away.
   */
  private sendMovedSection(value: unknown): boolean {
    const first: unknown = Array.isArray(value) ? value[0] : value;
    if (first !== MOVED_MERCHANT_RULES_SECTION) return false;
    void this.router.navigate(['/merchants'], { queryParams: { view: 'rules' }, replaceUrl: true });
    return true;
  }

  /** An unknown or missing section in the URL is replaced by the section shown, without a history entry. */
  private normaliseUrl(value: unknown): void {
    const first: unknown = Array.isArray(value) ? value[0] : value;
    if (first !== undefined && !isKnownSection(first)) {
      void this.router.navigate([], {
        queryParams: { section: this.section() },
        replaceUrl: true,
      });
    }
  }

  /** Deferred a tick so it lands after the router's own title update for the same navigation. */
  private setTitle(): void {
    setTimeout((): void =>
      this.title.setTitle(`${SECTION_TITLES[this.section()]} · Settings · Personal Finance`),
    );
  }

  /** Moves focus to the section's heading, so a screen reader hears where it landed. */
  private focusHeading(): void {
    afterNextRender(
      (): void => {
        const heading: HTMLElement | null | undefined =
          this.content()?.nativeElement.querySelector('h2');
        if (!heading) return;
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      },
      { injector: this.injector },
    );
  }

  /** The route's `canDeactivate`: leaving Settings with unsaved changes asks first. */
  canLeave(): Promise<boolean> {
    if (!this.guard.dirty()) return Promise.resolve(true);
    return new Promise<boolean>((resolve: (leave: boolean) => void): void => {
      this.confirmation.confirm({
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

  /** Closing or reloading the tab with unsaved changes makes the browser ask. */
  protected onBeforeUnload(event: Event): void {
    if (this.guard.dirty()) event.preventDefault();
  }

  /** The section list was used: switch, after asking when the current section has unsaved changes. */
  choose(next: SettingsSection): void {
    if (next === this.section()) return;
    this.askIfDirty((): void => {
      this.section.set(next);
      void this.router.navigate([], { queryParams: { section: next } });
      this.focusHeading();
    });
  }

  /** Browser Back or Forward changed the URL: follow it, or put it back if the user keeps editing. */
  private followUrl(params: Params): void {
    if (this.sendMovedSection(params['section'])) return;
    const next: SettingsSection = sectionFromParam(params['section']);
    if (next === this.section()) return;
    this.askIfDirty(
      (): void => {
        this.section.set(next);
        this.setTitle();
        this.focusHeading();
      },
      (): void => this.undoPop(),
    );
  }

  /**
   * Puts the history back after Back or Forward was refused: steps the browser the other way, so the
   * entries stay as they were. Without a known direction, rewrites the URL in place.
   */
  private undoPop(): void {
    if (this.lastPop === 'back') {
      this.location.forward();
    } else if (this.lastPop === 'forward') {
      this.location.back();
    } else {
      void this.router.navigate([], {
        queryParams: { section: this.section() },
        replaceUrl: true,
      });
    }
  }

  private askIfDirty(proceed: () => void, keep?: () => void): void {
    if (!this.guard.dirty()) {
      proceed();
      return;
    }
    this.confirmation.confirm({
      header: 'Discard changes?',
      message: 'You have unsaved changes. Discard them?',
      acceptLabel: 'Discard',
      rejectLabel: 'Keep editing',
      acceptButtonStyleClass: 'p-button-danger',
      accept: proceed,
      reject: keep,
    });
  }
}
