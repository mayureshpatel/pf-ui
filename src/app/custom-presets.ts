import {definePreset} from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import {Preset} from '@primeuix/themes/types';
import Material from '@primeuix/themes/material';

const CustomMaterialPreset = definePreset(Material, {
  semantic: {
    primary: {
      50: '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '{indigo.500}',
      600: '{indigo.600}',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}'
    }
  }
});

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
 * Cyberpunk Preset
 * High-contrast neon colors, stark dark backgrounds, and sharp edges.
 */
export const CyberpunkPreset: Preset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fdf2f8',
      100: '#fce7f3',
      200: '#fbcfe8',
      300: '#f9a8d4',
      400: '#f472b6',
      500: '#ec4899', // Neon Pink
      600: '#db2777',
      700: '#be185d',
      800: '#9d174d',
      900: '#831843',
      950: '#500724'
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a', // Very Dark Blue
          950: '#020617'
        }
      },
      dark: {
        surface: {
          0: '#09090b', // Stark Black
          50: '#18181b',
          100: '#27272a',
          200: '#3f3f46',
          300: '#52525b',
          400: '#71717a',
          500: '#a1a1aa',
          600: '#d4d4d8',
          700: '#e4e4e7',
          800: '#f4f4f5',
          900: '#fafafa',
          950: '#ffffff'
        }
      }
    }
  },
  components: {
    card: {
      colorScheme: {
        light: {root: {borderRadius: '0', shadow: 'none'}},
        dark: {root: {borderRadius: '0', shadow: '0 0 10px #ec4899, 0 0 20px #ec4899'}}
      }
    },
    button: {
      colorScheme: {
        light: {root: {borderRadius: '0'}},
        dark: {root: {borderRadius: '0'}}
      }
    },
    inputtext: {
      colorScheme: {
        light: {root: {borderRadius: '0'}},
        dark: {root: {borderRadius: '0'}}
      }
    }
  }
});

/**
 * Minimalist Preset
 * Monochromatic scheme with focus on typography and whitespace.
 */
export const MinimalistPreset: Preset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fafafa',
      100: '#f4f4f5',
      200: '#e4e4e7',
      300: '#d4d4d8',
      400: '#a1a1aa',
      500: '#71717a',
      600: '#52525b',
      700: '#3f3f46',
      800: '#27272a', // Dark Gray
      900: '#18181b',
      950: '#09090b'
    }
  },
  components: {
    card: {
      colorScheme: {
        light: {root: {borderRadius: '0', shadow: 'none'}},
        dark: {root: {borderRadius: '0', shadow: 'none'}}
      }
    },
    button: {
      colorScheme: {
        light: {root: {borderRadius: '0'}},
        dark: {root: {borderRadius: '0'}}
      }
    }
  }
});

/**
 * Retro Brutalism Preset
 * Bold colors, hard shadows, thick borders, and blocky shapes.
 */
export const RetroBrutalismPreset: Preset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316', // Bold Orange
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
      950: '#431407'
    },
    colorScheme: {
      light: {
        surface: {
          0: '#fef08a', // Yellowish background
          50: '#fef9c3',
          100: '#fef08a',
          200: '#fde047',
          300: '#facc15',
          400: '#eab308',
          500: '#ca8a04',
          600: '#a16207',
          700: '#854d0e',
          800: '#713f12',
          900: '#422006',
          950: '#000000'
        }
      }
    }
  },
  components: {
    card: {
      colorScheme: {
        light: {root: {borderRadius: '0', shadow: '4px 4px 0px #000'}},
        dark: {root: {borderRadius: '0', shadow: '4px 4px 0px #fff'}}
      }
    },
    button: {
      colorScheme: {
        light: {root: {borderRadius: '0'}},
        dark: {root: {borderRadius: '0'}}
      }
    },
    inputtext: {
      colorScheme: {
        light: {root: {borderRadius: '0', shadow: '2px 2px 0px #000', borderColor: '#000'}},
        dark: {root: {borderRadius: '0', shadow: '2px 2px 0px #fff', borderColor: '#fff'}}
      }
    }
  }
});

/**
 * Midnight Ocean Preset
 * Deep blues, moody lighting, subtle gradients and glows.
 */
export const MidnightOceanPreset: Preset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9', // Ocean Blue
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
      950: '#082f49'
    },
    colorScheme: {
      light: {
        surface: {
          0: '#f8fafc',
          50: '#f1f5f9',
          100: '#e2e8f0',
          200: '#cbd5e1',
          300: '#94a3b8',
          400: '#64748b',
          500: '#475569',
          600: '#334155',
          700: '#1e293b',
          800: '#0f172a',
          900: '#020617',
          950: '#000000'
        }
      },
      dark: {
        surface: {
          0: '#020617', // Very Deep Blue/Black
          50: '#0f172a',
          100: '#1e293b',
          200: '#334155',
          300: '#475569',
          400: '#64748b',
          500: '#94a3b8',
          600: '#cbd5e1',
          700: '#e2e8f0',
          800: '#f1f5f9',
          900: '#f8fafc',
          950: '#ffffff'
        }
      }
    }
  },
  components: {
    card: {
      colorScheme: {
        light: {
          root: {
            borderRadius: '1rem',
            shadow: '0 4px 6px -1px rgba(14, 165, 233, 0.1), 0 2px 4px -1px rgba(14, 165, 233, 0.06)'
          }
        },
        dark: {
          root: {
            borderRadius: '1rem',
            shadow: '0 10px 15px -3px rgba(14, 165, 233, 0.2), 0 4px 6px -2px rgba(14, 165, 233, 0.1)'
          }
        }
      }
    },
    button: {
      colorScheme: {
        light: {root: {borderRadius: '0.5rem'}},
        dark: {root: {borderRadius: '0.5rem'}}
      }
    }
  }
});

/**
 * Royal Amethyst Preset
 * Luxurious purples, soft curves, and elegant contrast.
 */
export const RoyalAmethystPreset: Preset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7', // Amethyst Purple
      600: '#9333ea',
      700: '#7e22ce',
      800: '#6b21a8',
      900: '#581c87',
      950: '#3b0764'
    }
  },
  components: {
    card: {
      colorScheme: {
        light: {
          root: {
            borderRadius: '1.5rem',
            shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)'
          }
        },
        dark: {
          root: {
            borderRadius: '1.5rem',
            shadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
          }
        }
      }
    },
    button: {
      colorScheme: {
        light: {root: {borderRadius: '2rem'}},
        dark: {root: {borderRadius: '2rem'}}
      }
    },
    inputtext: {
      colorScheme: {
        light: {root: {borderRadius: '1rem'}},
        dark: {root: {borderRadius: '1rem'}}
      }
    }
  }
});
