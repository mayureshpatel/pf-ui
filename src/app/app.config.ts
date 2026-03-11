import {ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {providePrimeNG} from 'primeng/config';
import {ConfirmationService, MessageService} from 'primeng/api';
import Aura from '@primeuix/themes/aura';

import {routes} from './app.routes';
import {jwtInterceptor} from '@core/auth/jwt.interceptor';
import {errorInterceptor} from '@core/auth/error.interceptor';
import {definePreset} from '@primeuix/themes';
import {Preset} from '@primeuix/themes/types';

const FinancePreset: Preset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
      950: '#022c22'
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09'
        }
      },
      dark: {
        surface: {
          0: '#ffffff',
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09'
        }
      }
    }
  },
  components: {
    card: {
      colorScheme: {
        light: {
          root: {
            borderRadius: '1.25rem',
            shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.03), 0 8px 10px -6px rgba(0, 0, 0, 0.02)'
          }
        },
        dark: {
          root: {
            borderRadius: '1.25rem',
            shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
          }
        }
      }
    },
    button: {
      colorScheme: {
        light: {
          root: {
            borderRadius: '0.75rem'
          }
        },
        dark: {
          root: {
            borderRadius: '0.75rem'
          }
        }
      }
    },
    inputtext: {
      colorScheme: {
        light: {
          root: {
            borderRadius: '0.75rem'
          }
        },
        dark: {
          root: {
            borderRadius: '0.75rem'
          }
        }
      }
    },
    dropdown: {
      colorScheme: {
        light: {
          root: {
            borderRadius: '0.75rem'
          }
        },
        dark: {
          root: {
            borderRadius: '0.75rem'
          }
        }
      }
    }
  }
});

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
        preset: FinancePreset,
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
