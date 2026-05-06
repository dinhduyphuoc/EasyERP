import { Router } from "express";
import { authenticate } from "@/common/middleware/authenticate";
import { resolveStoreContext } from "@/common/middleware/resolve-store-context";
import { requirePermission } from "@/common/middleware/require-permission";
import { CustomerController } from "./customer.controller";

const customerRouter = Router();
customerRouter.use(authenticate);
customerRouter.use(resolveStoreContext);

customerRouter.get("/categories", requirePermission("customers.read"), CustomerController.getCustomerCategories);
customerRouter.post("/:id/restore", requirePermission("customers.update"), CustomerController.restoreCustomer);
customerRouter.get("/:id", requirePermission("customers.read"), CustomerController.getCustomerById);
customerRouter.get("/", requirePermission("customers.read"), CustomerController.getCustomers);
customerRouter.post("/", requirePermission("customers.create"), CustomerController.createCustomer);
customerRouter.put("/:id", requirePermission("customers.update"), CustomerController.updateCustomer);
customerRouter.delete("/:id", requirePermission("customers.delete"), CustomerController.deleteCustomer);
customerRouter.delete("/", requirePermission("customers.delete"), CustomerController.deleteCustomers);

const locationRouter = Router();
locationRouter.use(authenticate);

locationRouter.get("/states", requirePermission("customers.read"), CustomerController.getStates);
locationRouter.get("/cities", requirePermission("customers.read"), CustomerController.getCities);
locationRouter.get("/districts", requirePermission("customers.read"), CustomerController.getDistricts);

export { customerRouter, locationRouter };
