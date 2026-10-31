import { Injectable } from '@angular/core';

/**
 * Lets the section on screen tell the Settings host whether it holds unsaved changes, so the host can
 * ask before switching sections. Provided by the host, so each section injects the host's instance.
 */
@Injectable()
export class SettingsGuard {
  private check: (() => boolean) | null = null;

  /** Registers the section's dirty check (the latest registration wins). */
  register(check: () => boolean): void {
    this.check = check;
  }

  /** Forgets a check, but only if it is still the registered one (a newer section may have replaced it). */
  unregister(check: () => boolean): void {
    if (this.check === check) this.check = null;
  }

  dirty(): boolean {
    return this.check?.() ?? false;
  }
}
