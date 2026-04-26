import { Router } from "express";
import { authenticate } from "@/common/middleware/authenticate";
import { requirePermission } from "@/common/middleware/require-permission";
import { RbacController } from "./rbac.controller";

const rbacRouter = Router();

rbacRouter.use(authenticate);

rbacRouter.get("/roles", requirePermission("users.read"), RbacController.listRoles);
rbacRouter.post("/roles", requirePermission("settings.update"), RbacController.createRole);
rbacRouter.put("/roles/:id", requirePermission("settings.update"), RbacController.updateRole);
rbacRouter.delete("/roles/:id", requirePermission("settings.update"), RbacController.deleteRole);
rbacRouter.get(
  "/permissions",
  requirePermission("users.read"),
  RbacController.listPermissions,
);

export { rbacRouter };
