/**
 * Represents the request payload for authentication.
 *
 * @property username - The username of the user.
 * @property password - The password of the user.
 */
export interface AuthRequest {
  username: string;
  password: string;
}

/**
 * Represents the request payload for registration.
 *
 * @property username - The username of the user.
 * @property email - The email address of the user.
 * @property password - The password of the user.
 */
export interface RegistrationRequest {
  username: string;
  email: string;
  password: string;
}

/**
 * Represents the response payload for authentication.
 *
 * @property token - The JWT token for the authenticated user.
 */
export interface AuthResponse {
  token: string;
}

/**
 * Represents a user object.
 *
 * Maps directly to the User entity in the database, without audit fields.
 *
 * @property id - The unique identifier of the user.
 * @property username - The username of the user.
 * @property email - The email address of the user.
 */
export interface User {
  id: number;
  username: string;
  email: string;
}


/**
 * Represents the payload of a JWT token.
 *
 * @property sub - The subject of the token.
 * @property userId - The ID of the user associated with the token.
 * @property email - The email address of the user associated with the token.
 * @property iat - The issued-at timestamp of the token.
 * @property exp - The expiration timestamp of the token.
 */
export interface JwtPayload {
  sub: string;
  userId: number;
  email: string;
  iat: number;
  exp: number;
}
