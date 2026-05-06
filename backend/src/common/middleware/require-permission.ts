import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "@/common";

export const requirePermission = (permission: string) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(new UnauthorizedError());
    }

    if (req.auth.permissions.includes(permission)) {
      return next();
    }

    return next(
      new ForbiddenError(undefined, {
        required_permission: permission,
      }),
    );
  };
};

export const requireAnyPermission = (permissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(new UnauthorizedError());
    }

    if (permissions.some((permission) => req.auth?.permissions.includes(permission))) {
      return next();
    }

    return next(
      new ForbiddenError(undefined, {
        required_any_permission: permissions,
      }),
    );
  };
};

export const requirePermissionResolver = (
  resolver: (req: Request) => string | string[],
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(new UnauthorizedError());
    }

    const resolved = resolver(req);
    const permissions = Array.isArray(resolved) ? resolved : [resolved];

    if (permissions.some((permission) => req.auth?.permissions.includes(permission))) {
      return next();
    }

    return next(
      new ForbiddenError(undefined, {
        required_any_permission: permissions,
      }),
    );
  };
};
