import { Router } from "express";
import { InventoryController } from "./inventory.controller";

const inventoryRouter = Router();

inventoryRouter.get("/stock", InventoryController.getStockList);
inventoryRouter.get("/audits", InventoryController.getAuditList);
inventoryRouter.get("/audits/:id", InventoryController.getAuditById);
inventoryRouter.get("/:productVariantId/history", InventoryController.getHistory);
inventoryRouter.get("/:productVariantId", InventoryController.getInventory);
inventoryRouter.post("/audits", InventoryController.createAudit);
inventoryRouter.put("/audits/:id", InventoryController.updateAudit);
inventoryRouter.delete("/audits/:id", InventoryController.deleteAudit);
inventoryRouter.post("/audits/:id/complete", InventoryController.completeAudit);
inventoryRouter.post("/initialize", InventoryController.initialize);
inventoryRouter.post("/adjust", InventoryController.adjust);
inventoryRouter.post("/reserve", InventoryController.reserve);
inventoryRouter.post("/release", InventoryController.release);
inventoryRouter.post("/move-to-packing", InventoryController.moveToPacking);
inventoryRouter.post("/pack-cancel", InventoryController.packCancel);
inventoryRouter.post("/fulfill", InventoryController.fulfill);
inventoryRouter.post("/return-restock", InventoryController.returnRestock);
inventoryRouter.post("/incoming-create", InventoryController.incomingCreate);
inventoryRouter.post("/incoming-receive", InventoryController.incomingReceive);

export { inventoryRouter };
