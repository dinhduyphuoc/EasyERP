import { Router } from "express";
import { authenticate } from "@/common/middleware/authenticate";
import { resolveStoreContext } from "@/common/middleware/resolve-store-context";
import {
  requirePermission,
  requirePermissionResolver,
} from "@/common/middleware/require-permission";
import { OrderController } from "./order.controller";

const orderRouter = Router();

const resolveOrderActionPermissions = (action: string | undefined) => {
  switch (action) {
    case "add_payment":
    case "confirm_full_payment":
    case "mark_paid":
      return ["payments.capture"];
    case "cancel":
      return ["orders.cancel"];
    case "return_order":
      return ["warehouse.return", "orders.update"];
    case "confirm":
    case "push_to_delivery":
    case "mark_delivered":
    case "request_invoice":
    case "complete":
      return ["orders.update"];
    default:
      return ["orders.update"];
  }
};

orderRouter.use(authenticate);
orderRouter.use(resolveStoreContext);

orderRouter.get("/overview", requirePermission("orders.read"), OrderController.getOrderOverview);
orderRouter.get("/options", requirePermission("orders.read"), OrderController.getOrderOptions);
orderRouter.get("/options/customers", requirePermission("orders.read"), OrderController.searchCustomers);
orderRouter.get("/options/products", requirePermission("orders.read"), OrderController.searchProducts);
orderRouter.get("/", requirePermission("orders.read"), OrderController.getOrders);
orderRouter.get("/:id/shipping/ghn/order-info", requirePermission("orders.read"), OrderController.getGHNOrderInfo);
orderRouter.get("/:id/shipping/ghn/tracking-logs", requirePermission("orders.read"), OrderController.getGHNTrackingLogs);
orderRouter.get("/:id/shipping/ghn/print-token", requirePermission("orders.read"), OrderController.getGHNPrintInfo);
orderRouter.get("/:id/history", requirePermission("orders.read"), OrderController.getOrderHistory);
orderRouter.get("/:id/edit", requirePermission("orders.read"), OrderController.getOrderForEdit);
orderRouter.get("/:id", requirePermission("orders.read"), OrderController.getOrderById);
orderRouter.post("/", requirePermission("orders.create"), OrderController.createOrder);
orderRouter.post("/:id/duplicate", requirePermission("orders.create"), OrderController.duplicateOrder);
orderRouter.patch("/:id", requirePermission("orders.update"), OrderController.updateOrder);
orderRouter.post(
  "/:id/actions/:action",
  requirePermissionResolver((req) => resolveOrderActionPermissions(req.params.action as string | undefined)),
  OrderController.runAction,
);

export { orderRouter };
