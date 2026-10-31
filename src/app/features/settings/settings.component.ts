import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { AppearanceSettingsComponent } from './components/appearance-settings/appearance-settings.component';
import { SettingsNavComponent } from './components/settings-nav/settings-nav.component';
import { CategoryRulesComponent } from './category-rules/category-rules.component';
import { TagsComponent } from './tags/tags.component';
import { SettingsGuard } from './settings.guard';
import { SettingsSection, sectionFromParam } from './utils/settings-helpers';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly confirmation: ConfirmationService = inject(ConfirmationService);
  private readonly guard: SettingsGuard = inject(SettingsGuard);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  readonly section: WritableSignal<SettingsSection> = signal(
    sectionFromParam(this.route.snapshot.queryParams['section']),
  );

  constructor() {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => this.followUrl(params));
  }

  /** The section list was used: switch, after asking when the current section has unsaved changes. */
  choose(next: SettingsSection): void {
    if (next === this.section()) return;
    this.askIfDirty((): void => {
      this.section.set(next);
      void this.router.navigate([], { queryParams: { section: next } });
    });
  }

  /** Browser Back or Forward changed the URL: follow it, or put it back if the user keeps editing. */
  private followUrl(params: Params): void {
    const next: SettingsSection = sectionFromParam(params['section']);
    if (next === this.section()) return;
    this.askIfDirty(
      (): void => this.section.set(next),
      (): void => {
        void this.router.navigate([], {
          queryParams: { section: this.section() },
          replaceUrl: true,
        });
      },
    );
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
