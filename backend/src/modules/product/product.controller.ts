import type { IncomingMessage, ServerResponse } from "node:http";
import { ProductService } from "./product.service";
import type { CreateProductInput } from "./product.types";

const sendJson = (
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
) => {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};

const readJsonBody = async <T>(req: IncomingMessage): Promise<T> => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf-8").trim();

  if (!rawBody) {
    throw new Error("Request body is required");
  }

  return JSON.parse(rawBody) as T;
};

const parseProductId = (value: string | undefined) => {
  const productId = Number(value);

  if (!value || Number.isNaN(productId) || productId <= 0) {
    return null;
  }

  return productId;
};

export const ProductController = {
  getProducts: async (_req: IncomingMessage, res: ServerResponse) => {
    try {
      const products = await ProductService.getProducts();
      return sendJson(res, 200, products);
    } catch (error) {
      console.error("Failed to fetch products", error);
      return sendJson(res, 500, { message: "Failed to fetch products" });
    }
  },

  getProductById: async (
    _req: IncomingMessage,
    res: ServerResponse,
    productIdParam: string | undefined,
  ) => {
    const productId = parseProductId(productIdParam);

    if (!productId) {
      return sendJson(res, 400, { message: "Invalid product_id" });
    }

    try {
      const product = await ProductService.getProductById(productId);

      if (!product) {
        return sendJson(res, 404, { message: "Product not found" });
      }

      return sendJson(res, 200, product);
    } catch (error) {
      console.error(`Failed to fetch product ${productId}`, error);
      return sendJson(res, 500, { message: "Failed to fetch product" });
    }
  },

  createProduct: async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const payload = await readJsonBody<CreateProductInput>(req);

      if (!payload.product_name?.trim()) {
        return sendJson(res, 400, { message: "product_name is required" });
      }

      const product = await ProductService.createProduct(payload);
      return sendJson(res, 201, product);
    } catch (error) {
      if (error instanceof SyntaxError) {
        return sendJson(res, 400, { message: "Invalid JSON body" });
      }

      if (error instanceof Error && error.message === "Request body is required") {
        return sendJson(res, 400, { message: error.message });
      }

      console.error("Failed to create product", error);
      return sendJson(res, 500, { message: "Failed to create product" });
    }
  }
};
