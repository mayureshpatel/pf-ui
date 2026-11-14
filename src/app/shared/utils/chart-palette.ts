/**
 * Chart colors, resolved from the design system because Chart.js cannot read CSS variables.
 * Every chart takes its colors from here so money in and money out look the same on every screen.
 * Series use primary-600 / rose-600 on light surfaces (3:1+ against white) and the 400 shades
 * on dark. Text and grid colors are the warm stone scale, never cool slate.
 */
export const CHART_PALETTE = {
  light: {
    income: '#059669',
    expense: '#e11d48',
    text: '#6b655f',
    legend: '#44403c',
    grid: '#e7e5e4',
    tooltip: '#1c1917',
  },
  dark: {
    income: '#34d399',
    expense: '#fb7185',
    text: '#a8a29e',
    legend: '#d6d3d1',
    grid: '#44403c',
    tooltip: '#292524',
  },
} as const;

export type ChartPalette = (typeof CHART_PALETTE)['light' | 'dark'];
