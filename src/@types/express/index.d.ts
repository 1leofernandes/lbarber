import 'express';

declare global {
  namespace Express {
    interface UserPayload {
      id: number;
      nome: string;
      email: string;
      role: string;
      roles?: string;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}
