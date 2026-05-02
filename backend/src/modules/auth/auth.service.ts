import { prisma } from "@lib/prisma";
import {
  BadRequestError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
} from "@/common";
import { AuditLogService } from "@/common/services/audit-log.service";
import { PasswordService } from "@/common/services/password.service";
import { SessionTokenService } from "@/common/services/session-token.service";
import type {
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from "./auth.types";

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LOCK_THRESHOLD = 5;
const LOGIN_FAILURE_LOCK_MS = 15 * 60 * 1000;

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const sanitizePermissionCodes = (permissionCodes: string[]) => [...new Set(permissionCodes)].sort();

const sanitizeRoleSlugs = (roleSlugs: string[]) => [...new Set(roleSlugs)].sort();

const sanitizeScopes = (
  scopes: Array<{
    scope_type: string;
    scope_value: string;
  }>,
) =>
  scopes.map((scope) => ({
    scope_type: scope.scope_type,
    scope_value: scope.scope_value,
  }));

const toUserAuthPayload = (user: {
  id: string;
  tenant_id: string | null;
  active_store_id: string | null;
  full_name: string;
  email: string;
  status: string;
  last_login_at: Date | null;
  roles: Array<{
    role: {
      slug: string;
      permissions: Array<{
        permission: {
          code: string;
        };
      }>;
    };
  }>;
  scopes: Array<{
    scope_type: string;
    scope_value: string;
  }>;
  stores: Array<{
    role: string;
    store: {
      id: string;
      name: string;
      slug: string;
      default_currency: string;
      default_timezone: string;
    };
  }>;
}) => {
  const roleSlugs = sanitizeRoleSlugs(user.roles.map((item) => item.role.slug));
  const permissionCodes = sanitizePermissionCodes(
    user.roles.flatMap((item) =>
      item.role.permissions.map((permissionItem) => permissionItem.permission.code),
    ),
  );

  return {
    id: user.id,
    tenant_id: user.tenant_id,
    active_store_id: user.active_store_id,
    full_name: user.full_name,
    email: user.email,
    status: user.status,
    last_login_at: user.last_login_at?.toISOString() ?? null,
    roles: roleSlugs,
    permissions: permissionCodes,
    scopes: sanitizeScopes(user.scopes),
    stores: user.stores
      .map((membership) => ({
        id: membership.store.id,
        name: membership.store.name,
        slug: membership.store.slug,
        role: membership.role,
        default_currency: membership.store.default_currency,
        default_timezone: membership.store.default_timezone,
        is_active: membership.store.id === user.active_store_id,
      }))
      .sort((left, right) => Number(right.is_active) - Number(left.is_active) || left.name.localeCompare(right.name)),
  };
};

const getUserAuthContext = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
    },
  });

  if (!user) {
    throw new UnauthorizedError();
  }

  if (user.status !== "active") {
    throw new ForbiddenError("Account is not active");
  }

  return toUserAuthPayload(user);
};

const validatePasswordInput = (password: string) => {
  if (typeof password !== "string" || password.length < 8) {
    throw new BadRequestError("Password must be at least 8 characters");
  }
};

const updateFailedLogin = async (
  userId: string,
  failureCount: number,
  shouldLock: boolean,
) => {
  const now = new Date();
  const lockedUntil = shouldLock
    ? new Date(now.getTime() + LOGIN_FAILURE_LOCK_MS)
    : null;

  return prisma.user.update({
    where: { id: userId },
    data: {
      failed_login_attempts: failureCount,
      last_failed_login_at: now,
      locked_until: lockedUntil,
    },
  });
};

const createSessionForUser = async (
  userId: string,
  tenantId: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
) => {
  const rawToken = SessionTokenService.generateToken();
  const hashedToken = SessionTokenService.hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const session = await prisma.session.create({
    data: {
      user_id: userId,
      tenant_id: tenantId,
      session_token_hash: hashedToken,
      status: "active",
      ip_address: ipAddress ?? null,
      user_agent: userAgent ?? null,
      expires_at: expiresAt,
      idle_expires_at: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
      last_used_at: now,
    },
  });

  return {
    raw_token: rawToken,
    session,
  };
};

export const AuthService = {
  login: async (input: LoginInput) => {
    const email = normalizeEmail(input.email);
    validatePasswordInput(input.password);

    const user = await prisma.user.findUnique({
      where: { email_normalized: email },
    });

    if (!user) {
      await AuditLogService.write({
        action: "auth.login_failed",
        resource_type: "user",
        status: "failed",
        ip_address: input.ip_address,
        user_agent: input.user_agent,
        request_id: input.request_id,
        metadata_json: {
          email,
          reason: "user_not_found",
        },
      });

      throw new UnauthorizedError("Email hoặc mật khẩu không đúng", "AUTH_INVALID_CREDENTIALS");
    }

    if (user.status === "blocked") {
      await AuditLogService.write({
        tenant_id: user.tenant_id,
        actor_user_id: user.id,
        target_user_id: user.id,
        action: "auth.login_blocked",
        resource_type: "user",
        resource_id: user.id,
        status: "blocked",
        ip_address: input.ip_address,
        user_agent: input.user_agent,
        request_id: input.request_id,
      });

      throw new ForbiddenError("Tài khoản đã bị khóa");
    }

    if (user.status !== "active") {
      throw new ForbiddenError("Tài khoản không hoạt động");
    }

    if (user.locked_until && user.locked_until > new Date()) {
      throw new TooManyRequestsError("Tài khoản đang bị khóa tạm thời", {
        locked_until: user.locked_until.toISOString(),
      });
    }

    const isValidPassword = await PasswordService.verifyPassword(
      user.password_hash,
      input.password,
    );

    if (!isValidPassword) {
      const failureCount = user.failed_login_attempts + 1;
      const shouldLock = failureCount >= LOGIN_FAILURE_LOCK_THRESHOLD;

      await updateFailedLogin(user.id, failureCount, shouldLock);
      await AuditLogService.write({
        tenant_id: user.tenant_id,
        actor_user_id: user.id,
        target_user_id: user.id,
        action: "auth.login_failed",
        resource_type: "user",
        resource_id: user.id,
        status: "failed",
        ip_address: input.ip_address,
        user_agent: input.user_agent,
        request_id: input.request_id,
        metadata_json: {
          reason: "invalid_password",
          failed_login_attempts: failureCount,
          locked: shouldLock,
        },
      });

      throw new UnauthorizedError("Email hoặc mật khẩu không đúng", "AUTH_INVALID_CREDENTIALS");
    }

    const authUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        failed_login_attempts: 0,
        last_failed_login_at: null,
        locked_until: null,
        last_login_at: new Date(),
        active_store_id: user.active_store_id,
      },
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
      },
    });

    const { raw_token, session } = await createSessionForUser(
      authUser.id,
      authUser.tenant_id,
      input.ip_address,
      input.user_agent,
    );

    const responseUser = toUserAuthPayload(authUser);

    await AuditLogService.write({
      tenant_id: authUser.tenant_id,
      actor_user_id: authUser.id,
      target_user_id: authUser.id,
      action: "auth.login_succeeded",
      resource_type: "session",
      resource_id: session.id,
      status: "success",
      ip_address: input.ip_address,
      user_agent: input.user_agent,
      request_id: input.request_id,
    });

    return {
      access_token: raw_token,
      token_type: "Bearer",
      expires_at: session.expires_at.toISOString(),
      session_id: session.id,
      user: responseUser,
    };
  },

  authenticateSession: async (token: string) => {
    const hashedToken = SessionTokenService.hashToken(token);
    const session = await prisma.session.findUnique({
      where: { session_token_hash: hashedToken },
      include: {
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
          },
        },
      },
    });

    if (!session || session.status !== "active" || session.revoked_at) {
      throw new UnauthorizedError();
    }

    if (session.expires_at <= new Date()) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          status: "expired",
        },
      });

      throw new UnauthorizedError("Session has expired", "AUTH_SESSION_EXPIRED");
    }

    if (session.user.status !== "active") {
      throw new ForbiddenError("Tài khoản không hoạt động");
    }

    await prisma.session.update({
      where: { id: session.id },
      data: {
        last_used_at: new Date(),
      },
    });

    const authUser = toUserAuthPayload(session.user);

    return {
      session_id: session.id,
      session_expires_at: session.expires_at.toISOString(),
      user: authUser,
      permissions: authUser.permissions,
    };
  },

  logout: async (
    token: string,
    input?: {
      actor_user_id?: string | null;
      ip_address?: string | null;
      user_agent?: string | null;
      request_id?: string | null;
    },
  ) => {
    const hashedToken = SessionTokenService.hashToken(token);
    const session = await prisma.session.findUnique({
      where: { session_token_hash: hashedToken },
      include: {
        user: {
          select: {
            id: true,
            tenant_id: true,
          },
        },
      },
    });

    if (!session) {
      return { revoked: false };
    }

    await prisma.session.update({
      where: { id: session.id },
      data: {
        status: "revoked",
        revoked_at: new Date(),
        revoke_reason: "logout",
      },
    });

    await AuditLogService.write({
      tenant_id: session.user.tenant_id,
      actor_user_id: input?.actor_user_id ?? session.user.id,
      target_user_id: session.user.id,
      action: "auth.logout",
      resource_type: "session",
      resource_id: session.id,
      status: "success",
      ip_address: input?.ip_address,
      user_agent: input?.user_agent,
      request_id: input?.request_id,
    });

    return { revoked: true };
  },

  forgotPassword: async (input: ForgotPasswordInput) => {
    const email = normalizeEmail(input.email);
    const user = await prisma.user.findUnique({
      where: { email_normalized: email },
      select: {
        id: true,
        tenant_id: true,
        email: true,
        status: true,
      },
    });

    if (!user || user.status !== "active") {
      return {
        message: "If the email exists, a reset link will be sent.",
      };
    }

    const rawToken = SessionTokenService.generateToken();
    const tokenHash = SessionTokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await prisma.userToken.create({
      data: {
        user_id: user.id,
        token_type: "password_reset",
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    await AuditLogService.write({
      tenant_id: user.tenant_id,
      actor_user_id: user.id,
      target_user_id: user.id,
      action: "auth.password_reset_requested",
      resource_type: "user",
      resource_id: user.id,
      status: "success",
      ip_address: input.ip_address,
      user_agent: input.user_agent,
      request_id: input.request_id,
    });

    return {
      message: "If the email exists, a reset link will be sent.",
      ...(process.env.NODE_ENV !== "production"
        ? {
            debug_reset_token: rawToken,
            debug_reset_token_expires_at: expiresAt.toISOString(),
          }
        : {}),
    };
  },

  resetPassword: async (input: ResetPasswordInput) => {
    validatePasswordInput(input.new_password);
    const tokenHash = SessionTokenService.hashToken(input.token);

    const tokenRecord = await prisma.userToken.findFirst({
      where: {
        token_hash: tokenHash,
        token_type: "password_reset",
        consumed_at: null,
        expires_at: {
          gt: new Date(),
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
    });

    if (!tokenRecord || tokenRecord.user.status !== "active") {
      throw new UnauthorizedError("Reset token is invalid or has expired", "AUTH_RESET_INVALID");
    }

    const passwordHash = await PasswordService.hashPassword(input.new_password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: tokenRecord.user.id },
        data: {
          password_hash: passwordHash,
          token_version: {
            increment: 1,
          },
        },
      }),
      prisma.userToken.update({
        where: { id: tokenRecord.id },
        data: {
          consumed_at: new Date(),
        },
      }),
      prisma.session.updateMany({
        where: {
          user_id: tokenRecord.user.id,
          status: "active",
        },
        data: {
          status: "revoked",
          revoked_at: new Date(),
          revoke_reason: "password_reset",
        },
      }),
    ]);

    await AuditLogService.write({
      tenant_id: tokenRecord.user.tenant_id,
      actor_user_id: tokenRecord.user.id,
      target_user_id: tokenRecord.user.id,
      action: "auth.password_reset_succeeded",
      resource_type: "user",
      resource_id: tokenRecord.user.id,
      status: "success",
      ip_address: input.ip_address,
      user_agent: input.user_agent,
      request_id: input.request_id,
    });

    return {
      message: "Password has been reset successfully.",
    };
  },

  getMe: async (userId: string) => getUserAuthContext(userId),
};
