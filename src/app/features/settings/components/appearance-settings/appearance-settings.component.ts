import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { ThemeMode, ThemeService } from '@core/services/theme.service';

interface ThemeOption {
  mode: ThemeMode;
  label: string;
  hint: string;
}

const OPTIONS: ThemeOption[] = [
  { mode: 'light', label: 'Light', hint: 'Always light' },
  { mode: 'dark', label: 'Dark', hint: 'Always dark' },
  { mode: 'system', label: 'System', hint: 'Matches your device' },
];

/**
 * The theme chooser: three cards (Light, Dark and System) in a radio group. The choice saves immediately,
 * on this device only, and is announced politely for screen readers.
 */
@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  templateUrl: './appearance-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppearanceSettingsComponent {
  protected readonly theme: ThemeService = inject(ThemeService);
  protected readonly options: ThemeOption[] = OPTIONS;

  /** What is announced after a change. */
  protected readonly announcement: Signal<string> = computed((): string => {
    const mode: ThemeMode = this.theme.mode();
    const label: string = OPTIONS.find((o: ThemeOption) => o.mode === mode)?.label ?? mode;
    return this.changed() ? `Theme set to ${label}.` : '';
  });

  private readonly changed: Signal<boolean> = computed((): boolean => this.touched() > 0);
  private readonly touched: WritableSignal<number> = signal(0);

  protected choose(mode: ThemeMode): void {
    this.theme.setMode(mode);
    this.touched.update((n: number): number => n + 1);
  }
}
