import express, { type Request, type Response } from "express";
import cors from "cors";
import { errorHandler, notFoundHandler } from "@/common";
import { productRouter } from "@/modules/product/product.routes";
import { customerRouter, locationRouter } from "@/modules/customer/customer.routes";
import { inventoryRouter } from "@/modules/inventory/inventory.routes";
import { orderRouter } from "@/modules/order/order.routes";

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
}));

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  return res.status(200).json({ ok: true, service: "backend" });
});

app.use("/products", productRouter);
app.use("/customers", customerRouter);
app.use("/locations", locationRouter);
app.use("/inventory", inventoryRouter);
app.use("/orders", orderRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
