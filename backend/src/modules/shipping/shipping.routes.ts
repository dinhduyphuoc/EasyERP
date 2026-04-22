import { Router } from "express";
import { ShippingController } from "./shipping.controller";

const shippingRouter = Router();

shippingRouter.get("/providers", ShippingController.listProviders);
shippingRouter.get("/providers/:code", ShippingController.getConnectionDetail);
shippingRouter.post("/providers/:code/connect", ShippingController.connectProvider);
shippingRouter.post("/providers/:code/disconnect", ShippingController.disconnectProvider);
shippingRouter.post("/providers/:code/verify", ShippingController.verifyProvider);
shippingRouter.post("/webhooks/ghn/order-status", ShippingController.receiveGHNOrderStatusCallback);
shippingRouter.post("/webhooks/ghn/ticket", ShippingController.receiveGHNTicketCallback);

export { shippingRouter };
