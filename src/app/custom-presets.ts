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
    // The segmented control's unselected labels (the dashboard period presets) are Aura's
    // surface.500, 4.40:1 on their surface.100 track. The muted text token is tuned to pass.
    togglebutton: {
      colorScheme: {
        light: {
          root: { color: '{text.muted.color}' },
          icon: { color: '{text.muted.color}' },
        },
      },
    },
    // PF-870: Aura fills the light-mode primary button with primary.500, which gives white text
    // 2.54:1. primary.700 gives 5.48:1. Dark mode is left as Aura has it (primary.400 with dark
    // text). Tracks PF-862's choice of primary.700 for emerald text.
    button: {
      colorScheme: {
        // The dark outlined and text buttons keep Aura's surface.500 (#78716c), 4.12:1 on the
        // near-black page. surface.400 gives 7.7:1.
        dark: {
          outlined: {
            secondary: { color: '{surface.400}', borderColor: '{surface.600}' },
          },
          text: {
            secondary: { color: '{surface.400}' },
          },
        },
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
            // PF-945: Aura's light danger fill is red.500, 3.76:1 under white text. rose.700 gives
            // 6.4:1 and matches the rose used for expense amounts and Logout.
            danger: {
              background: '{rose.700}',
              hoverBackground: '{rose.800}',
              activeBackground: '{rose.900}',
              borderColor: '{rose.700}',
              hoverBorderColor: '{rose.800}',
              activeBorderColor: '{rose.900}',
            },
          },
        },
      },
    },
    // PF-945: Aura's light toasts use the 600 shade for text on a 50-tint fill (success 3.16:1) and
    // a translucent background that lets the page bleed through. The 700 shades pass AA on an
    // opaque tint; the dark scheme is left as Aura has it (6.9:1 and above).
    // PF-945: the confirm's warning triangle is the caution glyph, so it takes the caution amber
    // (700 on white, 400 on dark) rather than the neutral grey it inherits; the destructive weight
    // stays on the rose Delete button.
    confirmdialog: {
      colorScheme: {
        light: { icon: { color: '{amber.700}' } },
        dark: { icon: { color: '{amber.400}' } },
      },
    },
    toast: {
      colorScheme: {
        light: {
          info: {
            background: '{blue.50}',
            color: '{blue.700}',
            closeButton: { focusRing: { color: '{blue.700}' } },
          },
          success: {
            background: '{green.50}',
            color: '{green.700}',
            closeButton: { focusRing: { color: '{green.700}' } },
          },
          warn: {
            background: '{yellow.50}',
            color: '{yellow.800}',
            closeButton: { focusRing: { color: '{yellow.800}' } },
          },
          error: {
            background: '{red.50}',
            color: '{red.700}',
            closeButton: { focusRing: { color: '{red.700}' } },
          },
        },
        // Aura's dark toasts are a 16% tint, so the page shows through; mix the same tint into the
        // near-black page colour instead so the text contrast does not depend on what is behind.
        dark: {
          info: { background: 'color-mix(in srgb, {blue.500} 16%, {surface.950})' },
          success: { background: 'color-mix(in srgb, {green.500} 16%, {surface.950})' },
          warn: { background: 'color-mix(in srgb, {yellow.500} 16%, {surface.950})' },
          error: { background: 'color-mix(in srgb, {red.500} 16%, {surface.950})' },
        },
      },
    },
  },
});
