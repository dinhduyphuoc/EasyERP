import type { Request, Response } from "express";
import type { UploadedFile } from "express-fileupload";
import { BadRequestError, UnauthorizedError } from "@/common";
import { uploadStoreAvatarToS3 } from "@lib/s3";
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

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
]);

const parseUploadedImage = (req: Request) => {
  const upload = req.files?.image ?? req.files?.file;

  if (!upload) {
    throw new BadRequestError("image file is required");
  }

  if (Array.isArray(upload)) {
    throw new BadRequestError("Only one image file is allowed");
  }

  const file = upload as UploadedFile;

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestError("Chỉ hỗ trợ ảnh JPG và PNG");
  }

  return file;
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

  uploadAvatar: async (req: Request<StoreParams>, res: Response) => {
    const user = getAuthUser(req);
    const file = parseUploadedImage(req);
    await StoreService.getStoreById(user.id, parseStoreId(req.params.id));

    const uploaded = await uploadStoreAvatarToS3({
      buffer: file.data,
      fileName: file.name,
      mimeType: file.mimetype,
    });

    return res.status(201).json(uploaded);
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
