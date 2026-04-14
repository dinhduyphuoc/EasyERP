import type { IncomingMessage, ServerResponse } from "node:http";
import { ProductService } from "@/modules/product/product.service";

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
    try {
      const products = await ProductService.getProducts();
      return sendJson(res, 200, products);
    } catch (error) {
      console.error("Failed to fetch products", error);
      return sendJson(res, 500, { message: "Failed to fetch products" });
    }
  }

  return sendJson(res, 404, { message: "Route not found" });
}
