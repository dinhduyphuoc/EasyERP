import { Router } from "express";
import { OrderController } from "./order.controller";

const orderRouter = Router();

orderRouter.get("/options", OrderController.getOrderOptions);
orderRouter.get("/", OrderController.getOrders);
orderRouter.get("/:id", OrderController.getOrderById);
orderRouter.post("/", OrderController.createOrder);

export { orderRouter };
