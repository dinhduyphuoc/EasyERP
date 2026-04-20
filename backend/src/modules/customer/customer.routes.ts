import { Router } from "express";
import { CustomerController } from "./customer.controller";

const customerRouter = Router();

customerRouter.get("/categories", CustomerController.getCustomerCategories);
customerRouter.get("/", CustomerController.getCustomers);
customerRouter.post("/", CustomerController.createCustomer);
customerRouter.delete("/", CustomerController.deleteCustomers);

const locationRouter = Router();

locationRouter.get("/states", CustomerController.getStates);
locationRouter.get("/cities", CustomerController.getCities);
locationRouter.get("/districts", CustomerController.getDistricts);

export { customerRouter, locationRouter };
