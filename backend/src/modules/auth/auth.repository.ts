import { prisma } from "@lib/prisma";

const USER_AUTH_CONTEXT_INCLUDE = {
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: {
                select: {
                  code: true,
                },
              },
            },
          },
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
  stores: {
    include: {
      store: {
        select: {
          id: true,
          name: true,
          slug: true,
          default_currency: true,
          default_timezone: true,
        },
      },
    },
  },
} as const;

const SESSION_AUTH_INCLUDE = {
  user: {
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const AuthRepository = {
  findUserAuthContextById: (userId: string) =>
    prisma.user.findUnique({
      where: { id: userId },
      include: USER_AUTH_CONTEXT_INCLUDE,
    }),

  updateFailedLogin: (args: {
    userId: string;
    failureCount: number;
    lastFailedLoginAt: Date;
    lockedUntil: Date | null;
  }) =>
    prisma.user.update({
      where: { id: args.userId },
      data: {
        failed_login_attempts: args.failureCount,
        last_failed_login_at: args.lastFailedLoginAt,
        locked_until: args.lockedUntil,
      },
    }),

  createSession: (args: {
    userId: string;
    tenantId: string | null;
    sessionTokenHash: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    expiresAt: Date;
    idleExpiresAt: Date;
    lastUsedAt: Date;
  }) =>
    prisma.session.create({
      data: {
        user_id: args.userId,
        tenant_id: args.tenantId,
        session_token_hash: args.sessionTokenHash,
        status: "active",
        ip_address: args.ipAddress ?? null,
        user_agent: args.userAgent ?? null,
        expires_at: args.expiresAt,
        idle_expires_at: args.idleExpiresAt,
        last_used_at: args.lastUsedAt,
      },
    }),

  findUserByNormalizedEmail: (email: string) =>
    prisma.user.findUnique({
      where: { email_normalized: email },
    }),

  updateUserAfterSuccessfulLogin: (args: {
    userId: string;
    activeStoreId: string | null;
    lastLoginAt: Date;
  }) =>
    prisma.user.update({
      where: { id: args.userId },
      data: {
        failed_login_attempts: 0,
        last_failed_login_at: null,
        locked_until: null,
        last_login_at: args.lastLoginAt,
        active_store_id: args.activeStoreId,
      },
      include: USER_AUTH_CONTEXT_INCLUDE,
    }),

  findSessionWithAuthUserByTokenHash: (hashedToken: string) =>
    prisma.session.findUnique({
      where: { session_token_hash: hashedToken },
      include: SESSION_AUTH_INCLUDE,
    }),

  expireSession: (sessionId: string) =>
    prisma.session.update({
      where: { id: sessionId },
      data: {
        status: "expired",
      },
    }),

  touchSession: (sessionId: string, lastUsedAt: Date, idleExpiresAt: Date) =>
    prisma.session.update({
      where: { id: sessionId },
      data: {
        last_used_at: lastUsedAt,
        idle_expires_at: idleExpiresAt,
      },
    }),

  findSessionForLogoutByTokenHash: (hashedToken: string) =>
    prisma.session.findUnique({
      where: { session_token_hash: hashedToken },
      include: {
        user: {
          select: {
            id: true,
            tenant_id: true,
          },
        },
      },
    }),

  revokeSession: (args: {
    sessionId: string;
    revokedAt: Date;
    revokeReason: string;
  }) =>
    prisma.session.update({
      where: { id: args.sessionId },
      data: {
        status: "revoked",
        revoked_at: args.revokedAt,
        revoke_reason: args.revokeReason,
      },
    }),

  findActiveUserByNormalizedEmailForPasswordReset: (email: string) =>
    prisma.user.findUnique({
      where: { email_normalized: email },
      select: {
        id: true,
        tenant_id: true,
        email: true,
        status: true,
      },
    }),

  createPasswordResetToken: (args: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) =>
    prisma.userToken.create({
      data: {
        user_id: args.userId,
        token_type: "password_reset",
        token_hash: args.tokenHash,
        expires_at: args.expiresAt,
      },
    }),

  findValidPasswordResetToken: (tokenHash: string, now: Date) =>
    prisma.userToken.findFirst({
      where: {
        token_hash: tokenHash,
        token_type: "password_reset",
        consumed_at: null,
        expires_at: {
          gt: now,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            tenant_id: true,
            status: true,
          },
        },
      },
    }),

  resetPasswordAndRevokeSessions: (args: {
    userId: string;
    tokenRecordId: string;
    passwordHash: string;
    consumedAt: Date;
    revokedAt: Date;
  }) =>
    prisma.$transaction([
      prisma.user.update({
        where: { id: args.userId },
        data: {
          password_hash: args.passwordHash,
          token_version: {
            increment: 1,
          },
        },
      }),
      prisma.userToken.update({
        where: { id: args.tokenRecordId },
        data: {
          consumed_at: args.consumedAt,
        },
      }),
      prisma.session.updateMany({
        where: {
          user_id: args.userId,
          status: "active",
        },
        data: {
          status: "revoked",
          revoked_at: args.revokedAt,
          revoke_reason: "password_reset",
        },
      }),
    ]),
};
