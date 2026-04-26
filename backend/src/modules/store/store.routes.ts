import { Router } from "express";
import { authenticate } from "@/common/middleware/authenticate";
import { StoreController } from "./store.controller";

const storeRouter = Router();

storeRouter.use(authenticate);

storeRouter.get("/", StoreController.getStores);
storeRouter.post("/", StoreController.createStore);
storeRouter.post("/switch", StoreController.switchStore);
storeRouter.get("/:id", StoreController.getStoreById);
storeRouter.patch("/:id", StoreController.updateStore);
storeRouter.delete("/:id", StoreController.deleteStore);

export { storeRouter };
