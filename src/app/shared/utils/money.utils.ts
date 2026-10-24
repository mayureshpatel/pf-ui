/** Rounds to whole cents so floating point noise never reaches a comparison or the screen. */
export const toCents = (value: number): number => Math.round(value * 100) / 100;
