import type { AuthSessionContext } from "@/modules/auth/auth.types";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthSessionContext;
      store?: {
        id: string;
        name: string;
        slug: string;
        role: string;
        default_currency: string;
        default_timezone: string;
      };
    }
  }
}

export {};
