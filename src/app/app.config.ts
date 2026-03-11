import {ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {providePrimeNG} from 'primeng/config';
import {ConfirmationService, MessageService} from 'primeng/api';

import {routes} from './app.routes';
import {jwtInterceptor} from '@core/auth/jwt.interceptor';
import {errorInterceptor} from '@core/auth/error.interceptor';
import Aura from '@primeuix/themes/aura';
import Lara from '@primeuix/themes/lara';
import Material from '@primeuix/themes/material';
import {MidnightOceanPreset} from './custom-presets';
/**
 * Fixes an issue with PrimeNG animations where elements are not hidden properly after leaving animations.
 *
 * This function adds a global event listener for 'animationend' events on the document.
 * When an animation with 'p-animate-' prefix and 'leave' suffix ends, it sets the visibility of the target element to 'hidden'.
 * This ensures that elements are properly hidden after leaving animations, preventing visual glitches.
 */
function initPrimengLeaveAnimationFix(): void {
  if (typeof document === 'undefined') return;

  document.addEventListener(
    'animationend',
    (event: AnimationEvent) => {
      if (
        event.animationName.startsWith('p-animate-') &&
        event.animationName.includes('leave')
      ) {
        (event.target as HTMLElement).style.visibility = 'hidden';
      }
    },
    true, // capture phase - fires before PrimeNG's element-level listener
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(initPrimengLeaveAnimationFix),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor])),
    providePrimeNG({
      theme: {
        preset: MidnightOceanPreset,
        options: {
          darkModeSelector: '.my-app-dark',
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng'
          }
        }
      },
      ripple: true
    }),
    MessageService,
    ConfirmationService
  ]
};
