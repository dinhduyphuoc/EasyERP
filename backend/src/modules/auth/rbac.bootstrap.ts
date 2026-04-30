import { prisma } from "@lib/prisma";

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
  super_admin: "Super Admin",
  admin: "Admin",
  sales: "Sales",
  warehouse: "Warehouse",
  accountant: "Accountant",
  customer_support: "Customer Support",
  viewer: "Viewer",
};

export const bootstrapRbac = async () => {
  await prisma.$transaction(async (tx) => {
    await tx.permission.createMany({
      data: SYSTEM_PERMISSIONS.map((permissionCode) => ({
        code: permissionCode,
      })),
      skipDuplicates: true,
    });

    const allPermissions = await tx.permission.findMany({
      where: {
        code: {
          in: [...SYSTEM_PERMISSIONS],
        },
      },
      select: {
        id: true,
        code: true,
      },
    });
    const permissionByCode = new Map(
      allPermissions.map((permission) => [permission.code, permission.id]),
    );

    for (const [roleSlug, permissionCodes] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
      const existingRole = await tx.role.findFirst({
        where: {
          tenant_id: null,
          slug: roleSlug,
        },
        select: {
          id: true,
        },
      });

      const role = existingRole
        ? await tx.role.update({
            where: {
              id: existingRole.id,
            },
            data: {
              name: SYSTEM_ROLE_NAMES[roleSlug] ?? roleSlug,
              is_system: true,
            },
          })
        : await tx.role.create({
            data: {
              tenant_id: null,
              slug: roleSlug,
              name: SYSTEM_ROLE_NAMES[roleSlug] ?? roleSlug,
              is_system: true,
            },
      });

      await tx.rolePermission.deleteMany({
        where: {
          role_id: role.id,
        },
      });

      await tx.rolePermission.createMany({
        data: permissionCodes.map((permissionCode) => {
          const permissionId = permissionByCode.get(permissionCode);

          if (!permissionId) {
            throw new Error(`Missing permission during RBAC bootstrap: ${permissionCode}`);
          }

          return {
            role_id: role.id,
            permission_id: permissionId,
          };
        }),
      });
    }
  }, {
    maxWait: 15_000,
    timeout: 60_000,
  });
};
