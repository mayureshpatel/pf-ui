import {ApplicationConfig, provideBrowserGlobalErrorListeners} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {providePrimeNG} from 'primeng/config';
import {ConfirmationService, MessageService} from 'primeng/api';
import Aura from '@primeuix/themes/aura';

import {routes} from './app.routes';
import {authInterceptor} from '@core/auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark-mode',
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
