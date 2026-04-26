import express, { type Request, type Response } from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import { errorHandler, notFoundHandler } from "@/common";
import { productRouter } from "@/modules/product/product.routes";
import { customerRouter, locationRouter } from "@/modules/customer/customer.routes";
import { inventoryRouter } from "@/modules/inventory/inventory.routes";
import { orderRouter } from "@/modules/order/order.routes";
import { shippingRouter } from "@/modules/shipping/shipping.routes";
import { authRouter } from "@/modules/auth/auth.routes";
import { adminRouter } from "@/modules/admin/admin.routes";
import { rbacRouter } from "@/modules/rbac/rbac.routes";
import { settingsRouter } from "@/modules/settings/settings.routes";
import { storeRouter } from "@/modules/store/store.routes";

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
}));

app.use(fileUpload({
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  abortOnLimit: true,
  parseNested: true,
}));

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  return res.status(200).json({ ok: true, service: "backend" });
});

app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/rbac", rbacRouter);
app.use("/settings", settingsRouter);
app.use("/stores", storeRouter);
app.use("/products", productRouter);
app.use("/customers", customerRouter);
app.use("/locations", locationRouter);
app.use("/inventory", inventoryRouter);
app.use("/orders", orderRouter);
app.use("/shipping", shippingRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
