import { Router } from "express";
import { authenticate } from "@/common/middleware/authenticate";
import { resolveStoreContext } from "@/common/middleware/resolve-store-context";
import { requirePermission } from "@/common/middleware/require-permission";
import { SettingsController } from "./settings.controller";

const settingsRouter = Router();

settingsRouter.use(authenticate);
settingsRouter.use(resolveStoreContext);

settingsRouter.get("/general", requirePermission("settings.read"), SettingsController.getGeneralSettings);
settingsRouter.put("/general", requirePermission("settings.update"), SettingsController.updateGeneralSettings);
settingsRouter.get(
  "/general/payment-methods/vietqr/banks",
  requirePermission("payments.read"),
  SettingsController.getVietQrBanks,
);
settingsRouter.get(
  "/general/payment-methods/vietqr/templates",
  requirePermission("payments.read"),
  SettingsController.getVietQrTemplates,
);
settingsRouter.post(
  "/general/payment-methods/vietqr/qr",
  requirePermission("payments.read"),
  SettingsController.generateVietQr,
);

export { settingsRouter };
