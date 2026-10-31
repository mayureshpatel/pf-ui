import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { Preset } from '@primeuix/themes/types';

/**
 * Base Emerald Preset
 */
export const FinancePreset: Preset = definePreset(Aura, {
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
      950: '#022c22',
    },
    colorScheme: {
      light: {
        // PF-870: Aura's muted text is surface.500 (#78716c), 4.40:1 on surface.100, just under AA.
        text: {
          mutedColor: '#6b655f',
        },
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
          950: '#0c0a09',
        },
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
          950: '#0c0a09',
        },
      },
    },
  },
  components: {
    // PF-870: Aura fills the light-mode primary button with primary.500, which gives white text
    // 2.54:1. primary.700 gives 5.48:1. Dark mode is left as Aura has it (primary.400 with dark
    // text). Tracks PF-862's choice of primary.700 for emerald text.
    button: {
      colorScheme: {
        light: {
          root: {
            primary: {
              background: '{primary.700}',
              hoverBackground: '{primary.800}',
              activeBackground: '{primary.900}',
              borderColor: '{primary.700}',
              hoverBorderColor: '{primary.800}',
              activeBorderColor: '{primary.900}',
            },
          },
        },
      },
    },
  },
});
