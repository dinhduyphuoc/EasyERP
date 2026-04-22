import { Router } from "express";
import { OrderController } from "./order.controller";

const orderRouter = Router();

orderRouter.get("/options", OrderController.getOrderOptions);
orderRouter.get("/", OrderController.getOrders);
orderRouter.get("/:id/shipping/ghn/print-token", OrderController.getGHNPrintInfo);
orderRouter.get("/:id", OrderController.getOrderById);
orderRouter.post("/", OrderController.createOrder);
orderRouter.post("/:id/duplicate", OrderController.duplicateOrder);
orderRouter.patch("/:id", OrderController.updateOrder);
orderRouter.post("/:id/actions/:action", OrderController.runAction);

export { orderRouter };
