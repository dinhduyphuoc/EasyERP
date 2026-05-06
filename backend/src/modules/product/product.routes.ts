import { Router } from "express";
import { authenticate } from "@/common/middleware/authenticate";
import { resolveStoreContext } from "@/common/middleware/resolve-store-context";
import { requirePermission } from "@/common/middleware/require-permission";
import { ProductController } from "./product.controller";

const productRouter = Router();

productRouter.use(authenticate);
productRouter.use(resolveStoreContext);

productRouter.get("/categories", requirePermission("products.read"), ProductController.getCategories);
productRouter.post("/categories", requirePermission("products.create"), ProductController.createCategory);
productRouter.delete("/categories", requirePermission("products.delete"), ProductController.deleteCategories);
productRouter.get("/categories/:id", requirePermission("products.read"), ProductController.getCategoryById);
productRouter.put("/categories/:id", requirePermission("products.update"), ProductController.editCategory);
productRouter.post("/upload-image", requirePermission("products.update"), ProductController.uploadImage);
productRouter.post("/crop-image", requirePermission("products.update"), ProductController.cropImage);
productRouter.post("/import", requirePermission("products.create"), ProductController.importProducts);
productRouter.get("/", requirePermission("products.read"), ProductController.getProducts);
productRouter.post("/", requirePermission("products.create"), ProductController.createProduct);
productRouter.delete("/", requirePermission("products.delete"), ProductController.deleteProducts);
productRouter.get("/:id", requirePermission("products.read"), ProductController.getProductById);
productRouter.put("/:id", requirePermission("products.update"), ProductController.editProduct);

export { productRouter };
