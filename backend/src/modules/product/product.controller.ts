import type { Request, Response } from "express";
import type { UploadedFile } from "express-fileupload";
import { BadRequestError } from "@/common";
import { uploadProductImageToS3 } from "@lib/s3";
import { ProductService } from "./product.service";
import type {
  BulkDeleteRequestInput,
  ProductCategoryParams,
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

  getCategories: async (_req: Request, res: Response) => {
    const categories = await ProductService.getCategories();
    return res.status(200).json(categories);
  },

  getCategoryById: async (
    req: Request<ProductCategoryParams>,
    res: Response,
  ) => {
    const category = await ProductService.getCategoryById(parseId(req.params.id));

    return res.status(200).json(category);
  },

  getProducts: async (_req: Request, res: Response) => {
    const products = await ProductService.getProducts();
    return res.status(200).json(products);
  },

  getProductById: async (req: Request<ProductParams>, res: Response) => {
    const product = await ProductService.getProductById(parseId(req.params.id));

    return res.status(200).json(product);
  },

  createProduct: async (
    req: Request<{}, {}, ProductRequestInput>,
    res: Response,
  ) => {
    const product = await ProductService.createProduct(
      parsePayload<ProductRequestInput>(req.body),
    );
    return res.status(201).json(product);
  },

  createCategory: async (
    req: Request<{}, {}, ProductCategoryRequestInput>,
    res: Response,
  ) => {
    const category = await ProductService.createCategory(
      parsePayload<ProductCategoryRequestInput>(req.body),
    );

    return res.status(201).json(category);
  },

  editProduct: async (
    req: Request<ProductParams, {}, ProductRequestInput>,
    res: Response,
  ) => {
    const updatedProduct = await ProductService.editProduct(
      parseId(req.params.id),
      parsePayload<ProductRequestInput>(req.body),
    );

    return res.status(200).json(updatedProduct);
  },

  editCategory: async (
    req: Request<ProductCategoryParams, {}, ProductCategoryRequestInput>,
    res: Response,
  ) => {
    const category = await ProductService.editCategory(
      parseId(req.params.id),
      parsePayload<ProductCategoryRequestInput>(req.body),
    );

    return res.status(200).json(category);
  },

  deleteCategories: async (req: Request<{}, {}, BulkDeleteRequestInput>, res: Response) => {
    await ProductService.deleteCategories(parseIds(req.body));
    return res.status(204).send();
  },

  deleteProducts: async (req: Request<{}, {}, BulkDeleteRequestInput>, res: Response) => {
    const result = await ProductService.deleteProducts(parseIds(req.body));
    return res.status(200).json(result);
  },
};
