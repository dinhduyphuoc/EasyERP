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
  ProductParams,
  ProductRequestInput,
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

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
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
    throw new BadRequestError("Only JPG, PNG, WEBP or GIF images are allowed");
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

  getProducts: async (_req: Request, res: Response) => {
    if (!_req.store) {
      throw new UnauthorizedError("Store context is required");
    }
    const products = await ProductService.getProducts(_req.store.id);
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
