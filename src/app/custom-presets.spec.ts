import { FinancePreset } from './custom-presets';

/**
 * PF-870: the light-mode theme tokens behind two Lighthouse `color-contrast` failures. The
 * tokens are resolved from the preset itself, so these fail if a shade is changed to one that
 * no longer meets WCAG AA (4.5:1 for normal text).
 */
describe('FinancePreset light-mode contrast', () => {
  const AA = 4.5;

  /** Reads a dotted path out of the preset, or undefined when any step is missing. */
  function read(path: string): unknown {
    return path
      .split('.')
      .reduce<unknown>(
        (node, key) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
        FinancePreset,
      );
  }

  /** Resolves "#hex" or a "{primary.700}" / "{surface.100}" reference to a hex colour. */
  function hex(value: unknown): string {
    if (typeof value !== 'string') throw new Error(`not a colour: ${String(value)}`);
    const ref = /^\{(primary|surface)\.(\d+)\}$/.exec(value);
    if (!ref) return value;
    const scope = ref[1] === 'primary' ? 'semantic.primary' : 'semantic.colorScheme.light.surface';
    return hex(read(`${scope}.${ref[2]}`));
  }

  function luminance(color: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(color.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  describe('primary button', () => {
    const states = ['background', 'hoverBackground', 'activeBackground'];

    it.each(states)('should keep white text readable on the %s', (state) => {
      // arrange
      const background = hex(read(`components.button.colorScheme.light.root.primary.${state}`));

      // assert & verify
      expect(contrast('#ffffff', background)).toBeGreaterThanOrEqual(AA);
    });
  });

  describe('muted text', () => {
    // the surfaces the app puts muted captions and segmented-control labels on
    it.each(['0', '50', '100'])('should be readable on surface %s', (shade) => {
      // arrange
      const muted = hex(read('semantic.colorScheme.light.text.mutedColor'));
      const surface = hex(read(`semantic.colorScheme.light.surface.${shade}`));

      // assert & verify
      expect(contrast(muted, surface)).toBeGreaterThanOrEqual(AA);
    });
  });
});
