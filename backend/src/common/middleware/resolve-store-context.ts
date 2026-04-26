import type { NextFunction, Request, Response } from "express";
import { prisma } from "@lib/prisma";
import { BadRequestError, ForbiddenError, UnauthorizedError } from "@/common";

const STORE_HEADER = "x-store-id";

export const resolveStoreContext = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    const requestedStoreId = req.header(STORE_HEADER)?.trim();
    const fallbackStoreId = req.auth.user.active_store_id ?? req.auth.user.stores[0]?.id ?? null;
    const storeId = requestedStoreId || fallbackStoreId;

    if (!storeId) {
      throw new ForbiddenError("No store is available for the current user");
    }

    const membership = await prisma.userStore.findUnique({
      where: {
        user_id_store_id: {
          user_id: req.auth.user.id,
          store_id: storeId,
        },
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            default_currency: true,
            default_timezone: true,
            deleted_at: true,
          },
        },
      },
    });

    if (!membership || membership.store.deleted_at) {
      throw new ForbiddenError("You do not have access to this store");
    }

    req.store = {
      id: membership.store.id,
      name: membership.store.name,
      slug: membership.store.slug,
      role: membership.role,
      default_currency: membership.store.default_currency,
      default_timezone: membership.store.default_timezone,
    };

    if (requestedStoreId && requestedStoreId !== membership.store.id) {
      throw new BadRequestError("Invalid X-Store-Id header");
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
