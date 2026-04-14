import type { IncomingMessage, ServerResponse } from "node:http";
import { ProductController } from "@/modules/product/product.controller";

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

export async function app(req: IncomingMessage, res: ServerResponse) {
  const method = req.method ?? "GET";
  const url = req.url ?? "/";

  if (method === "GET" && url === "/health") {
    return sendJson(res, 200, { ok: true, service: "backend" });
  }

  if (method === "GET" && url === "/products") {
    return ProductController.getProducts(req, res);
  }

  if (method === "POST" && url === "/products") {
    return ProductController.createProduct(req, res);
  }

  if (method === "GET" && url.startsWith("/products/")) {
    const productId = url.split("/")[2];
    return ProductController.getProductById(req, res, productId);
  }

  return sendJson(res, 404, { message: "Route not found" });
}
