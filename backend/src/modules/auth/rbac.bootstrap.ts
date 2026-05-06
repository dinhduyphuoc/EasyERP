import { RbacRepository } from "@/modules/rbac/rbac.repository";

const SYSTEM_PERMISSIONS = [
  "orders.create",
  "orders.read",
  "orders.update",
  "orders.vat.update",
  "orders.cancel",
  "orders.refund",
  "orders.export",
  "customers.create",
  "customers.read",
  "customers.update",
  "customers.delete",
  "products.create",
  "products.read",
  "products.update",
  "products.delete",
  "inventory.read",
  "inventory.adjust",
  "inventory.reserve",
  "inventory.release",
  "warehouse.pick",
  "warehouse.pack",
  "warehouse.ship",
  "warehouse.return",
  "payments.read",
  "payments.capture",
  "payments.refund",
  "payments.reconcile",
  "reports.read",
  "reports.export",
  "users.create",
  "users.read",
  "users.update",
  "users.disable",
  "users.assign_role",
  "settings.read",
  "settings.update",
  "audit_logs.read",
  "shipping.credentials.read_masked",
  "shipping.credentials.update",
  "shipping.credentials.verify",
] as const;

const SYSTEM_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  super_admin: SYSTEM_PERMISSIONS,
  admin: [
    "orders.read",
    "orders.update",
    "orders.vat.update",
    "orders.cancel",
    "orders.export",
    "customers.read",
    "customers.update",
    "products.read",
    "products.update",
    "inventory.read",
    "inventory.adjust",
    "inventory.reserve",
    "inventory.release",
    "warehouse.pick",
    "warehouse.pack",
    "warehouse.ship",
    "warehouse.return",
    "payments.read",
    "payments.capture",
    "payments.refund",
    "payments.reconcile",
    "reports.read",
    "reports.export",
    "users.create",
    "users.read",
    "users.update",
    "users.disable",
    "users.assign_role",
    "settings.read",
    "settings.update",
    "audit_logs.read",
    "shipping.credentials.read_masked",
    "shipping.credentials.update",
    "shipping.credentials.verify",
  ],
  sales: [
    "orders.create",
    "orders.read",
    "orders.update",
    "orders.cancel",
    "orders.export",
    "customers.create",
    "customers.read",
    "customers.update",
    "products.read",
    "reports.read",
  ],
  warehouse: [
    "orders.read",
    "inventory.read",
    "inventory.reserve",
    "inventory.release",
    "warehouse.pick",
    "warehouse.pack",
    "warehouse.ship",
    "warehouse.return",
    "products.read",
  ],
  accountant: [
    "orders.read",
    "payments.read",
    "payments.capture",
    "payments.refund",
    "payments.reconcile",
    "reports.read",
    "reports.export",
  ],
  customer_support: [
    "orders.read",
    "customers.read",
    "customers.update",
    "reports.read",
  ],
  viewer: [
    "orders.read",
    "customers.read",
    "products.read",
    "inventory.read",
    "payments.read",
    "reports.read",
  ],
};

const SYSTEM_ROLE_NAMES: Record<string, string> = {
  super_admin: "Admin",
  admin: "Quản trị viên",
  sales: "Nhân viên bán hàng",
  warehouse: "Quản lý kho",
  accountant: "Kế toán",
  customer_support: "Hỗ trợ khách hàng",
  viewer: "Người xem",
};

export const bootstrapRbac = async () => {
  await RbacRepository.withTransaction(async (tx) => {
    await RbacRepository.createPermissionsIfMissingTx(tx, SYSTEM_PERMISSIONS);

    const allPermissions = await RbacRepository.findPermissionsByCodesTx(tx, SYSTEM_PERMISSIONS);
    const permissionByCode = new Map(
      allPermissions.map((permission) => [permission.code, permission.id]),
    );

    for (const [roleSlug, permissionCodes] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
      const existingRole = await RbacRepository.findSystemRoleBySlugTx(tx, roleSlug);

      const role = existingRole
        ? await RbacRepository.updateSystemRoleTx(
            tx,
            existingRole.id,
            SYSTEM_ROLE_NAMES[roleSlug] ?? roleSlug,
          )
        : await RbacRepository.createSystemRoleTx(
            tx,
            roleSlug,
            SYSTEM_ROLE_NAMES[roleSlug] ?? roleSlug,
          );

      const permissionIds = permissionCodes.map((permissionCode) => {
        const permissionId = permissionByCode.get(permissionCode);

        if (!permissionId) {
          throw new Error(`Missing permission during RBAC bootstrap: ${permissionCode}`);
        }

        return permissionId;
      });

      await RbacRepository.replaceRolePermissionsTx(tx, role.id, permissionIds);
    }
  }, {
    maxWait: 15_000,
    timeout: 60_000,
  });
};
