import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * App initializer that restores the signed-in session from the refresh cookie on startup.
 *
 * Angular waits for an initializer's promise before the first navigation, so `requireAuth` and
 * `guestGuard` always decide after the restore has settled; the guards themselves stay
 * synchronous. Resolves false (never rejects) when there is no session to restore.
 */
export function restoreSessionOnStartup(): Promise<boolean> {
  return inject(AuthService).restoreSession();
}
