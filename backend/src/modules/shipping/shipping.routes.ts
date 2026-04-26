import { Router } from "express";
import { authenticate } from "@/common/middleware/authenticate";
import {
  requireAnyPermission,
  requirePermission,
} from "@/common/middleware/require-permission";
import { ShippingController } from "./shipping.controller";

const shippingRouter = Router();

shippingRouter.post("/webhooks/ghn/order-status", ShippingController.receiveGHNOrderStatusCallback);
shippingRouter.post("/webhooks/ghn/ticket", ShippingController.receiveGHNTicketCallback);

shippingRouter.use(authenticate);

shippingRouter.get("/providers", requirePermission("settings.read"), ShippingController.listProviders);
shippingRouter.get("/providers/:code", requirePermission("settings.read"), ShippingController.getConnectionDetail);
shippingRouter.get("/providers/:code/addresses/provinces", requireAnyPermission(["orders.read", "orders.create", "settings.read"]), ShippingController.listProviderProvinces);
shippingRouter.get("/providers/:code/addresses/districts", requireAnyPermission(["orders.read", "orders.create", "settings.read"]), ShippingController.listProviderDistricts);
shippingRouter.get("/providers/:code/addresses/wards", requireAnyPermission(["orders.read", "orders.create", "settings.read"]), ShippingController.listProviderWards);
shippingRouter.post("/providers/:code/locations/resolve", requireAnyPermission(["orders.read", "orders.create", "settings.read"]), ShippingController.resolveProviderLocation);
shippingRouter.post("/providers/:code/services", requireAnyPermission(["orders.read", "orders.create", "settings.read"]), ShippingController.listAvailableServices);
shippingRouter.post("/providers/:code/services/by-location", requireAnyPermission(["orders.read", "orders.create", "settings.read"]), ShippingController.listAvailableServicesByLocation);
shippingRouter.post("/providers/:code/fee", requireAnyPermission(["orders.read", "orders.create", "settings.read"]), ShippingController.calculateFee);
shippingRouter.post("/providers/:code/fee/by-location", requireAnyPermission(["orders.read", "orders.create", "settings.read"]), ShippingController.calculateFeeByLocation);
shippingRouter.post("/providers/:code/connect", requirePermission("shipping.credentials.update"), ShippingController.connectProvider);
shippingRouter.post("/providers/:code/disconnect", requirePermission("shipping.credentials.update"), ShippingController.disconnectProvider);
shippingRouter.post("/providers/:code/verify", requirePermission("shipping.credentials.verify"), ShippingController.verifyProvider);

export { shippingRouter };
