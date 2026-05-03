import { prisma } from "@lib/prisma";

export type RbacTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const RbacRepository = {
  withTransaction: <T>(
    fn: (tx: RbacTransaction) => Promise<T>,
    options?: Parameters<typeof prisma.$transaction>[1],
  ) => prisma.$transaction(fn, options),

  findPermissionsByCodes: (permissionCodes: string[]) =>
    prisma.permission.findMany({
      where: {
        code: {
          in: permissionCodes,
        },
      },
      select: {
        id: true,
        code: true,
      },
    }),

  findAllRolesWithPermissions: () =>
    prisma.role.findMany({
      where: {
        tenant_id: null,
      },
      include: {
        permissions: {
          include: {
            permission: {
              select: {
                code: true,
                description: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          name: "asc",
        },
      ],
    }),

  findRoleBySlug: (slug: string) =>
    prisma.role.findFirst({
      where: {
        tenant_id: null,
        slug,
      },
      select: {
        id: true,
      },
    }),

  createRoleWithPermissions: (args: {
    slug: string;
    name: string;
    description: string | null;
    permissions: Array<{ id: string }>;
  }) =>
    prisma.role.create({
      data: {
        tenant_id: null,
        slug: args.slug,
        name: args.name,
        description: args.description,
        is_system: false,
        permissions: {
          create: args.permissions.map((permission) => ({
            permission_id: permission.id,
          })),
        },
      },
      include: {
        permissions: {
          include: {
            permission: {
              select: {
                code: true,
                description: true,
              },
            },
          },
        },
      },
    }),

  findRoleForUpdate: (id: string) =>
    prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        is_system: true,
      },
    }),

  replaceRolePermissionsAndLoad: (args: {
    id: string;
    name: string;
    description: string | null;
    permissions: Array<{ id: string }>;
  }) =>
    prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: args.id },
        data: {
          name: args.name,
          description: args.description,
        },
      });

      await tx.rolePermission.deleteMany({
        where: {
          role_id: args.id,
        },
      });

      await tx.rolePermission.createMany({
        data: args.permissions.map((permission) => ({
          role_id: args.id,
          permission_id: permission.id,
        })),
      });

      return tx.role.findUniqueOrThrow({
        where: { id: args.id },
        include: {
          permissions: {
            include: {
              permission: {
                select: {
                  code: true,
                  description: true,
                },
              },
            },
          },
        },
      });
    }),

  findRoleWithUsers: (id: string) =>
    prisma.role.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            user_id: true,
          },
        },
      },
    }),

  deleteRole: (id: string) =>
    prisma.role.delete({
      where: { id },
    }),

  findAllPermissions: () =>
    prisma.permission.findMany({
      orderBy: [
        {
          code: "asc",
        },
      ],
    }),

  createPermissionsIfMissingTx: (tx: RbacTransaction, permissionCodes: readonly string[]) =>
    tx.permission.createMany({
      data: permissionCodes.map((code) => ({ code })),
      skipDuplicates: true,
    }),

  findPermissionsByCodesTx: (tx: RbacTransaction, permissionCodes: readonly string[]) =>
    tx.permission.findMany({
      where: {
        code: {
          in: [...permissionCodes],
        },
      },
      select: {
        id: true,
        code: true,
      },
    }),

  findSystemRoleBySlugTx: (tx: RbacTransaction, slug: string) =>
    tx.role.findFirst({
      where: {
        tenant_id: null,
        slug,
      },
      select: {
        id: true,
      },
    }),

  updateSystemRoleTx: (tx: RbacTransaction, id: string, name: string) =>
    tx.role.update({
      where: {
        id,
      },
      data: {
        name,
        is_system: true,
      },
    }),

  createSystemRoleTx: (tx: RbacTransaction, slug: string, name: string) =>
    tx.role.create({
      data: {
        tenant_id: null,
        slug,
        name,
        is_system: true,
      },
    }),

  replaceRolePermissionsTx: (
    tx: RbacTransaction,
    roleId: string,
    permissionIds: readonly string[],
  ) =>
    tx.rolePermission
      .deleteMany({
        where: {
          role_id: roleId,
        },
      })
      .then(() =>
        tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            role_id: roleId,
            permission_id: permissionId,
          })),
        }),
      ),
};
