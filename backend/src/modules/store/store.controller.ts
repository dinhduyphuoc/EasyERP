import type { Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "@/common";
import { StoreService } from "./store.service";
import type {
  CreateStoreInput,
  StoreParams,
  SwitchStoreInput,
  UpdateStoreInput,
} from "./store.types";

const parseBody = <T>(body: unknown) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestError("Request body is required");
  }

  return body as T;
};

const parseStoreId = (value: string | undefined) => {
  const id = value?.trim();

  if (!id) {
    throw new BadRequestError("Invalid store id");
  }

  return id;
};

const getAuthUser = (req: Request) => {
  if (!req.auth) {
    throw new UnauthorizedError();
  }

  return req.auth.user;
};

export const StoreController = {
  createStore: async (req: Request<{}, {}, CreateStoreInput>, res: Response) => {
    const user = getAuthUser(req);
    const store = await StoreService.createStore(user, parseBody<CreateStoreInput>(req.body));
    return res.status(201).json(store);
  },

  getStores: async (req: Request, res: Response) => {
    const user = getAuthUser(req);
    const stores = await StoreService.getUserStores(user.id);
    return res.status(200).json(stores);
  },

  getStoreById: async (req: Request<StoreParams>, res: Response) => {
    const user = getAuthUser(req);
    const store = await StoreService.getStoreById(user.id, parseStoreId(req.params.id));
    return res.status(200).json(store);
  },

  updateStore: async (
    req: Request<StoreParams, {}, UpdateStoreInput>,
    res: Response,
  ) => {
    const user = getAuthUser(req);
    const store = await StoreService.updateStore(
      user.id,
      parseStoreId(req.params.id),
      parseBody<UpdateStoreInput>(req.body),
    );
    return res.status(200).json(store);
  },

  deleteStore: async (req: Request<StoreParams>, res: Response) => {
    const user = getAuthUser(req);
    const result = await StoreService.deleteStore(user.id, parseStoreId(req.params.id));
    return res.status(200).json(result);
  },

  switchStore: async (req: Request<{}, {}, SwitchStoreInput>, res: Response) => {
    const user = getAuthUser(req);
    const payload = parseBody<SwitchStoreInput>(req.body);
    const storeId = parseStoreId(payload.store_id);
    const store = await StoreService.switchStore(user.id, storeId);
    return res.status(200).json(store);
  },
};
