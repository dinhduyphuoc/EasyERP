import { Router } from "express";
import { authenticate } from "@/common/middleware/authenticate";
import { resolveStoreContext } from "@/common/middleware/resolve-store-context";
import { requirePermission } from "@/common/middleware/require-permission";
import { InventoryController } from "./inventory.controller";

const inventoryRouter = Router();

inventoryRouter.use(authenticate);
inventoryRouter.use(resolveStoreContext);

inventoryRouter.get("/stock", requirePermission("inventory.read"), InventoryController.getStockList);
inventoryRouter.get("/audits", requirePermission("inventory.read"), InventoryController.getAuditList);
inventoryRouter.get("/audits/:id", requirePermission("inventory.read"), InventoryController.getAuditById);
inventoryRouter.get("/:productVariantId/history", requirePermission("inventory.read"), InventoryController.getHistory);
inventoryRouter.get("/:productVariantId", requirePermission("inventory.read"), InventoryController.getInventory);
inventoryRouter.post("/audits", requirePermission("inventory.adjust"), InventoryController.createAudit);
inventoryRouter.put("/audits/:id", requirePermission("inventory.adjust"), InventoryController.updateAudit);
inventoryRouter.delete("/audits/:id", requirePermission("inventory.adjust"), InventoryController.deleteAudit);
inventoryRouter.post("/audits/:id/complete", requirePermission("inventory.adjust"), InventoryController.completeAudit);
inventoryRouter.post("/initialize", requirePermission("inventory.adjust"), InventoryController.initialize);
inventoryRouter.post("/adjust", requirePermission("inventory.adjust"), InventoryController.adjust);
inventoryRouter.post("/reserve", requirePermission("inventory.reserve"), InventoryController.reserve);
inventoryRouter.post("/release", requirePermission("inventory.release"), InventoryController.release);
inventoryRouter.post("/move-to-packing", requirePermission("warehouse.pick"), InventoryController.moveToPacking);
inventoryRouter.post("/pack-cancel", requirePermission("warehouse.pack"), InventoryController.packCancel);
inventoryRouter.post("/fulfill", requirePermission("warehouse.ship"), InventoryController.fulfill);
inventoryRouter.post("/return-restock", requirePermission("warehouse.return"), InventoryController.returnRestock);
inventoryRouter.post("/incoming-create", requirePermission("inventory.adjust"), InventoryController.incomingCreate);
inventoryRouter.post("/incoming-receive", requirePermission("inventory.adjust"), InventoryController.incomingReceive);

export { inventoryRouter };
