import { Router } from "express";
import { CustomerController } from "./customer.controller";

const customerRouter = Router();

customerRouter.get("/categories", CustomerController.getCustomerCategories);
customerRouter.post("/:id/restore", CustomerController.restoreCustomer);
customerRouter.get("/:id", CustomerController.getCustomerById);
customerRouter.get("/", CustomerController.getCustomers);
customerRouter.post("/", CustomerController.createCustomer);
customerRouter.put("/:id", CustomerController.updateCustomer);
customerRouter.delete("/:id", CustomerController.deleteCustomer);
customerRouter.delete("/", CustomerController.deleteCustomers);

const locationRouter = Router();

locationRouter.get("/states", CustomerController.getStates);
locationRouter.get("/cities", CustomerController.getCities);
locationRouter.get("/districts", CustomerController.getDistricts);

export { customerRouter, locationRouter };
