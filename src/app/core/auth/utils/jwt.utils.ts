import {JwtPayload, User} from '@models/auth.model';

/**
 * Decodes a JWT token and returns its payload.
 *
 * This function handles the Base64Url decoding of the JWT payload part.
 *
 * @param token - The JWT token to decode.
 * @returns The decoded payload or null if the token is invalid or malformed.
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const parts: string[] = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload: string = parts[1];
    const decoded: string = atob(payload.replaceAll('-', '+').replaceAll('_', '/'));
    return JSON.parse(decoded) as JwtPayload;
  } catch (error) {
    console.error('Failed to decode JWT token:', error);
    return null;
  }
}

/**
 * Checks if a JWT token has expired based on its payload.
 *
 * @param payload - The decoded JWT payload containing the 'exp' claim.
 * @returns True if the token has expired, false otherwise.
 */
export function isTokenExpired(payload: JwtPayload): boolean {
  const now: number = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

/**
 * Extracts a User object from a JWT token if it is valid and not expired.
 *
 * @param token - The JWT token to process.
 * @returns The user object extracted from the token, or null if invalid/expired.
 */
export function getUserFromToken(token: string | null): User | null {
  if (!token) {
    return null;
  }

  const payload: JwtPayload | null = decodeToken(token);
  if (!payload || isTokenExpired(payload)) {
    return null;
  }

  return {
    id: payload.userId,
    username: payload.sub,
    email: payload.email
  };
}
