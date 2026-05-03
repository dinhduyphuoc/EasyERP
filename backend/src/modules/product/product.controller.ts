import type { Request, Response } from "express";
import type { UploadedFile } from "express-fileupload";
import sharp from "sharp";
import { BadRequestError, UnauthorizedError } from "@/common";
import { getManagedProductImageBufferFromUrl, uploadProductImageToS3 } from "@lib/s3";
import { ProductService } from "./product.service";
import type {
  BulkDeleteRequestInput,
  ProductCategoryParams,
  ProductImageCropRequestInput,
  ProductCategoryRequestInput,
  ProductListQuery,
  ProductParams,
  ProductRequestInput,
  ProductStatusInput,
} from "./product.types";

const parseId = (value: string | undefined) => {
  const id = Number(value);

  if (!value || Number.isNaN(id) || id <= 0) {
    throw new BadRequestError("Invalid id");
  }

  return id;
};

const parsePayload = <T>(body: unknown) => {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body is required");
  }

  return body as T;
};

const parseImageCropPayload = (body: unknown) => {
  const payload = parsePayload<ProductImageCropRequestInput>(body);
  const crop = payload.crop;

  if (!payload.image_url || typeof payload.image_url !== "string") {
    throw new BadRequestError("image_url is required");
  }

  if (!crop || typeof crop !== "object") {
    throw new BadRequestError("crop is required");
  }

  const x = Number(crop.x);
  const y = Number(crop.y);
  const width = Number(crop.width);
  const height = Number(crop.height);

  if ([x, y, width, height].some((value) => !Number.isFinite(value))) {
    throw new BadRequestError("crop coordinates must be valid numbers");
  }

  if (x < 0 || y < 0 || width <= 0 || height <= 0) {
    throw new BadRequestError("crop coordinates must be positive");
  }

  return {
    image_url: payload.image_url,
    crop: {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    },
  };
};

const parseIds = (body: unknown) => {
  const payload = parsePayload<BulkDeleteRequestInput>(body);

  if (!Array.isArray(payload.ids) || payload.ids.length === 0) {
    throw new BadRequestError("ids must be a non-empty array");
  }

  const ids = payload.ids.map((value) => Number(value));

  if (ids.some((id) => Number.isNaN(id) || id <= 0 || !Number.isInteger(id))) {
    throw new BadRequestError("ids must contain valid positive integers");
  }

  return [...new Set(ids)];
};

const PRODUCT_STATUSES = new Set<ProductStatusInput>([
  "active",
  "inactive",
  "draft",
  "deleted",
]);

const parseBooleanFlag = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    throw new BadRequestError("Boolean query value is invalid");
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new BadRequestError("Boolean query value must be true or false");
};

const parsePositiveInteger = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${fieldName} must be a positive integer`);
  }

  return parsed;
};

const parseProductListQuery = (query: Record<string, unknown>): ProductListQuery => {
  const search = typeof query.search === "string" && query.search.trim().length > 0
    ? query.search.trim()
    : undefined;
  const status =
    typeof query.status === "string" && query.status.trim().length > 0
      ? query.status.trim()
      : undefined;

  if (status && !PRODUCT_STATUSES.has(status as ProductStatusInput)) {
    throw new BadRequestError("status must be one of: active, inactive, draft, deleted");
  }

  return {
    search,
    status: status as ProductStatusInput | undefined,
    category_id: parsePositiveInteger(query.category_id, "category_id"),
    include_deleted: parseBooleanFlag(query.include_deleted),
    page: parsePositiveInteger(query.page, "page"),
    page_size: parsePositiveInteger(query.page_size, "page_size"),
  };
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

export const ProductController = {
  uploadImage: async (req: Request, res: Response) => {
    const file = parseUploadedImage(req);
    const uploaded = await uploadProductImageToS3({
      buffer: file.data,
      fileName: file.name,
      mimeType: file.mimetype,
    });

    return res.status(201).json(uploaded);
  },

  cropImage: async (req: Request<{}, {}, ProductImageCropRequestInput>, res: Response) => {
    const payload = parseImageCropPayload(req.body);
    const source = await getManagedProductImageBufferFromUrl(payload.image_url);
    const croppedBuffer = await sharp(source.buffer)
      .extract({
        left: payload.crop.x,
        top: payload.crop.y,
        width: payload.crop.width,
        height: payload.crop.height,
      })
      .png()
      .toBuffer();

    const uploaded = await uploadProductImageToS3({
      buffer: croppedBuffer,
      fileName: `${source.key.split("/").pop() ?? "product-image"}-cropped.png`,
      mimeType: "image/png",
    });

    return res.status(201).json(uploaded);
  },

  getCategories: async (_req: Request, res: Response) => {
    if (!_req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const categories = await ProductService.getCategories(_req.store.id);
    return res.status(200).json(categories);
  },

  getCategoryById: async (
    req: Request<ProductCategoryParams>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const category = await ProductService.getCategoryById(req.store.id, parseId(req.params.id));

    return res.status(200).json(category);
  },

  getProducts: async (req: Request<{}, {}, {}, ProductListQuery>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const products = await ProductService.getProducts(
      req.store.id,
      parseProductListQuery(req.query as Record<string, unknown>),
    );
    return res.status(200).json(products);
  },

  getProductById: async (req: Request<ProductParams>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const product = await ProductService.getProductById(req.store.id, parseId(req.params.id));

    return res.status(200).json(product);
  },

  createProduct: async (
    req: Request<{}, {}, ProductRequestInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const product = await ProductService.createProduct(
      req.store.id,
      parsePayload<ProductRequestInput>(req.body),
    );
    return res.status(201).json(product);
  },

  createCategory: async (
    req: Request<{}, {}, ProductCategoryRequestInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const category = await ProductService.createCategory(
      req.store.id,
      parsePayload<ProductCategoryRequestInput>(req.body),
    );

    return res.status(201).json(category);
  },

  editProduct: async (
    req: Request<ProductParams, {}, ProductRequestInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const updatedProduct = await ProductService.editProduct(
      req.store.id,
      parseId(req.params.id),
      parsePayload<ProductRequestInput>(req.body),
    );

    return res.status(200).json(updatedProduct);
  },

  editCategory: async (
    req: Request<ProductCategoryParams, {}, ProductCategoryRequestInput>,
    res: Response,
  ) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const category = await ProductService.editCategory(
      req.store.id,
      parseId(req.params.id),
      parsePayload<ProductCategoryRequestInput>(req.body),
    );

    return res.status(200).json(category);
  },

  deleteCategories: async (req: Request<{}, {}, BulkDeleteRequestInput>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    await ProductService.deleteCategories(req.store.id, parseIds(req.body));
    return res.status(204).send();
  },

  deleteProducts: async (req: Request<{}, {}, BulkDeleteRequestInput>, res: Response) => {
    if (!req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const result = await ProductService.deleteProducts(req.store.id, parseIds(req.body));
    return res.status(200).json(result);
  },
};
