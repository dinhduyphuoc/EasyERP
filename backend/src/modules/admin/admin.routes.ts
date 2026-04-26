import { Router } from "express";
import { authenticate } from "@/common/middleware/authenticate";
import { requirePermission } from "@/common/middleware/require-permission";
import { AdminController } from "./admin.controller";

const adminRouter = Router();

adminRouter.use(authenticate);

adminRouter.get("/users", requirePermission("users.read"), AdminController.listUsers);
adminRouter.post("/users", requirePermission("users.create"), AdminController.createUser);
adminRouter.put(
  "/users/:id/roles",
  requirePermission("users.assign_role"),
  AdminController.assignRoles,
);
adminRouter.patch(
  "/users/:id/status",
  requirePermission("users.disable"),
  AdminController.updateStatus,
);

export { adminRouter };
