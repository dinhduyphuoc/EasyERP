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
    case "confirm_shipping":
    case "push_to_delivery":
    case "request_invoice":
    case "complete":
      return ["orders.update"];
    default:
      return ["orders.update"];
  }
};

orderRouter.use(authenticate);
orderRouter.use(resolveStoreContext);

orderRouter.get("/options", requirePermission("orders.read"), OrderController.getOrderOptions);
orderRouter.get("/", requirePermission("orders.read"), OrderController.getOrders);
orderRouter.get("/:id/shipping/ghn/print-token", requirePermission("orders.read"), OrderController.getGHNPrintInfo);
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
