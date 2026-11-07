import { Merchant } from '@models/merchant.model';

/**
 * The id of the "Create" option a merchant field offers for a typed name (PF-933). It can never
 * collide with a real merchant id, which is always positive.
 */
export const NEW_MERCHANT_ID = -1;

/**
 * The merchants to choose from, plus a "Create" option for what has been typed when creating is
 * allowed and no merchant already has that name (ignoring case and surrounding spaces), so a name
 * is never created twice.
 */
export function merchantOptions(
  merchants: Merchant[],
  typed: string,
  allowCreate: boolean,
): Merchant[] {
  const name: string = typed.trim();
  const exists: boolean = merchants.some(
    (m: Merchant): boolean => m.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (!allowCreate || !name || exists) return merchants;
  return [...merchants, { id: NEW_MERCHANT_ID, name } as Merchant];
}
