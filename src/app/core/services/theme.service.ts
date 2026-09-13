import { Injectable, signal, WritableSignal } from '@angular/core';

const DARK_MODE_KEY = 'pf_dark_mode';
const DARK_MODE_CLASS = 'my-app-dark';

/**
 * Manages the app's dark/light theme, toggled via the `.my-app-dark` class
 * `app.config.ts`'s `darkModeSelector` and `styles.css`'s `@custom-variant dark` both key off.
 *
 * The initial value is read from the DOM, not `localStorage` directly -- `index.html`'s inline
 * bootstrap script already applies the persisted class before Angular loads (avoiding a
 * flash of the wrong theme), so the class is already authoritative by the time this service
 * constructs.
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly isDarkMode: WritableSignal<boolean> = signal(
    document.documentElement.classList.contains(DARK_MODE_CLASS),
  );

  setDarkMode(enabled: boolean): void {
    document.documentElement.classList.toggle(DARK_MODE_CLASS, enabled);
    localStorage.setItem(DARK_MODE_KEY, String(enabled));
    this.isDarkMode.set(enabled);
  }
}
