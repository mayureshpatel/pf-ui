import { Injectable, signal, WritableSignal } from '@angular/core';

const DARK_MODE_KEY = 'pf_dark_mode';
const THEME_KEY = 'pf_theme';
const DARK_MODE_CLASS = 'my-app-dark';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** What the user chose: a fixed theme, or whatever the device is set to. */
export type ThemeMode = 'light' | 'dark' | 'system';

const isMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system';

/**
 * Manages the app's dark/light theme, toggled via the `.my-app-dark` class
 * `app.config.ts`'s `darkModeSelector` and `styles.css`'s `@custom-variant dark` both key off.
 *
 * The initial value is read from the DOM, not `localStorage` directly -- `index.html`'s inline
 * bootstrap script already applies the class before Angular loads (avoiding a flash of the wrong
 * theme), so the class is already authoritative by the time this service constructs. The choice is
 * saved as `pf_theme` ("light", "dark" or "system"); `pf_dark_mode` ("true" or "false") is still
 * written for what is shown, and read when no `pf_theme` was ever saved by an older version.
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  /** Whether the dark theme is showing now (the choice, or the device setting for System). */
  readonly isDarkMode: WritableSignal<boolean> = signal(
    document.documentElement.classList.contains(DARK_MODE_CLASS),
  );
  /** The user's choice. */
  readonly mode: WritableSignal<ThemeMode> = signal(this.savedMode());

  constructor() {
    this.deviceQuery()?.addEventListener('change', (): void => {
      if (this.mode() === 'system') this.apply();
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    this.apply();
    try {
      localStorage.setItem(THEME_KEY, mode);
      localStorage.setItem(DARK_MODE_KEY, String(this.isDarkMode()));
    } catch {
      // Storage unavailable (private mode, quota): the theme still changes for this visit.
    }
  }

  setDarkMode(enabled: boolean): void {
    this.setMode(enabled ? 'dark' : 'light');
  }

  private apply(): void {
    const mode: ThemeMode = this.mode();
    const dark: boolean =
      mode === 'system' ? (this.deviceQuery()?.matches ?? false) : mode === 'dark';
    document.documentElement.classList.toggle(DARK_MODE_CLASS, dark);
    this.isDarkMode.set(dark);
  }

  private deviceQuery(): MediaQueryList | null {
    return typeof matchMedia === 'function' ? matchMedia(DARK_QUERY) : null;
  }

  private savedMode(): ThemeMode {
    try {
      const saved: string | null = localStorage.getItem(THEME_KEY);
      if (isMode(saved)) return saved;
      const legacy: string | null = localStorage.getItem(DARK_MODE_KEY);
      if (legacy === 'true') return 'dark';
      if (legacy === 'false') return 'light';
    } catch {
      // fall through to the default
    }
    return 'system';
  }
}
