export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface JwtPayload {
  sub: string;
  userId: number;
  email: string;
  iat: number;
  exp: number;
}
