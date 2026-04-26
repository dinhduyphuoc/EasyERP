import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "@/common";
import { AuthService } from "@/modules/auth/auth.service";

const getBearerToken = (req: Request) => {
  const header = req.header("authorization");

  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
};

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = getBearerToken(req);

    if (!token) {
      throw new UnauthorizedError();
    }

    req.auth = await AuthService.authenticateSession(token);
    return next();
  } catch (error) {
    return next(error);
  }
};
