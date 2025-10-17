import { Request } from 'express';
import { User } from '@shared/schema';

declare module 'express-session' {
  interface SessionData {
    passport?: {
      user: number;
    };
  }
}

export interface RequestWithUser extends Request {
  user?: User;
  isAuthenticated(): boolean;
  logout(callback: (err: any) => void): void;
}