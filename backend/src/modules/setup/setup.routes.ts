import { Router } from "express";
import { SetupController } from "./setup.controller";

const setupRouter = Router();

setupRouter.get("/status", SetupController.getStatus);
setupRouter.post("/initial", SetupController.initialize);

export { setupRouter };
