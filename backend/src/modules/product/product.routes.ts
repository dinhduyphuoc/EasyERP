import { Router } from "express";
import { ProductController } from "./product.controller";

const productRouter = Router();

productRouter.get("/categories", ProductController.getCategories);
productRouter.post("/categories", ProductController.createCategory);
productRouter.delete("/categories", ProductController.deleteCategories);
productRouter.get("/categories/:id", ProductController.getCategoryById);
productRouter.put("/categories/:id", ProductController.editCategory);
productRouter.post("/upload-image", ProductController.uploadImage);
productRouter.get("/", ProductController.getProducts);
productRouter.post("/", ProductController.createProduct);
productRouter.delete("/", ProductController.deleteProducts);
productRouter.get("/:id", ProductController.getProductById);
productRouter.put("/:id", ProductController.editProduct);

export { productRouter };
