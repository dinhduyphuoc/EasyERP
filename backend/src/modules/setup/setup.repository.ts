import { prisma } from "@lib/prisma";

export type SetupTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const SetupRepository = {
  getSetupCounts: async () => {
    const [userCount, tenantCount, storeCount, adminUserCount] = await Promise.all([
      prisma.user.count(),
      prisma.tenant.count(),
      prisma.store.count({
        where: {
          deleted_at: null,
        },
      }),
      prisma.user.count({
        where: {
          roles: {
            some: {
              role: {
                slug: {
                  in: ["super_admin", "admin"],
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      userCount,
      tenantCount,
      storeCount,
      adminUserCount,
    };
  },

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

  findTenantBySlugTx: (tx: SetupTransaction, slug: string) =>
    tx.tenant.findUnique({
      where: { slug },
      select: { id: true },
    }),

  findStoreBySlugTx: (tx: SetupTransaction, slug: string) =>
    tx.store.findUnique({
      where: { slug },
      select: { id: true },
    }),
};
