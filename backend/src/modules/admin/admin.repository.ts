import { prisma } from "@lib/prisma";

export type AdminTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const USER_SUMMARY_INCLUDE = {
  roles: {
    include: {
      role: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
  },
  scopes: {
    select: {
      scope_type: true,
      scope_value: true,
    },
  },
} as const;

export const AdminRepository = {
  findRolesBySlugs: (roleSlugs: string[]) =>
    prisma.role.findMany({
      where: {
        slug: {
          in: roleSlugs,
        },
        tenant_id: null,
      },
    }),

  findAllUsersWithSummary: () =>
    prisma.user.findMany({
      include: USER_SUMMARY_INCLUDE,
      orderBy: [
        {
          created_at: "desc",
        },
      ],
    }),

  findUserIdByNormalizedEmail: (email: string) =>
    prisma.user.findUnique({
      where: { email_normalized: email },
      select: { id: true },
    }),

  createUserWithRoles: (args: {
    tenantId: string | null;
    fullName: string;
    email: string;
    passwordHash: string;
    actorUserId: string;
    roles: Array<{ id: string }>;
  }) =>
    prisma.user.create({
      data: {
        tenant_id: args.tenantId,
        full_name: args.fullName,
        email: args.email,
        email_normalized: args.email,
        password_hash: args.passwordHash,
        status: "active",
        roles: {
          create: args.roles.map((role) => ({
            role_id: role.id,
            assigned_by: args.actorUserId,
          })),
        },
      },
      include: {
        roles: USER_SUMMARY_INCLUDE.roles,
      },
    }),

  findUserTenantById: (userId: string) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenant_id: true,
      },
    }),

  replaceUserRoles: (args: {
    userId: string;
    actorUserId: string;
    roles: Array<{ id: string }>;
  }) =>
    prisma.$transaction([
      prisma.userRole.deleteMany({
        where: {
          user_id: args.userId,
        },
      }),
      prisma.userRole.createMany({
        data: args.roles.map((role) => ({
          user_id: args.userId,
          role_id: role.id,
          assigned_by: args.actorUserId,
        })),
      }),
    ]),

  findUserSummaryByIdOrThrow: (userId: string) =>
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: USER_SUMMARY_INCLUDE,
    }),

  updateUserStatus: (args: {
    userId: string;
    status: "active" | "blocked" | "inactive";
    lockedUntil: Date | null;
  }) =>
    prisma.user.update({
      where: { id: args.userId },
      data: {
        status: args.status,
        locked_until: args.lockedUntil,
      },
      include: USER_SUMMARY_INCLUDE,
    }),

  revokeActiveSessionsByUserId: (args: {
    userId: string;
    revokeReason: string;
    revokedAt: Date;
  }) =>
    prisma.session.updateMany({
      where: {
        user_id: args.userId,
        status: "active",
      },
      data: {
        status: "revoked",
        revoked_at: args.revokedAt,
        revoke_reason: args.revokeReason,
      },
    }),
};
