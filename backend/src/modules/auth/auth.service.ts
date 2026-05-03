import {
  BadRequestError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
} from "@/common";
import { AuditLogService } from "@/common/services/audit-log.service";
import { PasswordService } from "@/common/services/password.service";
import { SessionTokenService } from "@/common/services/session-token.service";
import { AuthRepository } from "./auth.repository";
import type {
  AuthenticatedSessionUser,
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

const toSessionAuthUser = (user: {
  id: string;
  tenant_id: string | null;
  active_store_id: string | null;
  full_name: string;
  email: string;
  status: string;
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
}): AuthenticatedSessionUser => ({
  id: user.id,
  tenant_id: user.tenant_id,
  active_store_id: user.active_store_id,
  full_name: user.full_name,
  email: user.email,
  status: user.status,
  roles: sanitizeRoleSlugs(user.roles.map((item) => item.role.slug)),
});

const getUserAuthContext = async (userId: string) => {
  const user = await AuthRepository.findUserAuthContextById(userId);

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

  return AuthRepository.updateFailedLogin({
    userId,
    failureCount,
    lastFailedLoginAt: now,
    lockedUntil,
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

  const session = await AuthRepository.createSession({
    userId,
    tenantId,
    sessionTokenHash: hashedToken,
    ipAddress,
    userAgent,
    expiresAt,
    idleExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
    lastUsedAt: now,
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

    const user = await AuthRepository.findUserByNormalizedEmail(email);

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

    const authUser = await AuthRepository.updateUserAfterSuccessfulLogin({
      userId: user.id,
      activeStoreId: user.active_store_id,
      lastLoginAt: new Date(),
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
    const session = await AuthRepository.findSessionWithAuthUserByTokenHash(hashedToken);

    if (!session || session.status !== "active" || session.revoked_at) {
      throw new UnauthorizedError();
    }

    if (session.expires_at <= new Date()) {
      await AuthRepository.expireSession(session.id);

      throw new UnauthorizedError("Session has expired", "AUTH_SESSION_EXPIRED");
    }

    if (session.user.status !== "active") {
      throw new ForbiddenError("Tài khoản không hoạt động");
    }

    await AuthRepository.touchSession(session.id, new Date());

    const authUser = toSessionAuthUser(session.user);
    const permissions = sanitizePermissionCodes(
      session.user.roles.flatMap((item) =>
        item.role.permissions.map((permissionItem) => permissionItem.permission.code),
      ),
    );

    return {
      session_id: session.id,
      session_expires_at: session.expires_at.toISOString(),
      user: authUser,
      permissions,
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
    const session = await AuthRepository.findSessionForLogoutByTokenHash(hashedToken);

    if (!session) {
      return { revoked: false };
    }

    await AuthRepository.revokeSession({
      sessionId: session.id,
      revokedAt: new Date(),
      revokeReason: "logout",
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
    const user = await AuthRepository.findActiveUserByNormalizedEmailForPasswordReset(email);

    if (!user || user.status !== "active") {
      return {
        message: "If the email exists, a reset link will be sent.",
      };
    }

    const rawToken = SessionTokenService.generateToken();
    const tokenHash = SessionTokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await AuthRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
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

    const tokenRecord = await AuthRepository.findValidPasswordResetToken(tokenHash, new Date());

    if (!tokenRecord || tokenRecord.user.status !== "active") {
      throw new UnauthorizedError("Reset token is invalid or has expired", "AUTH_RESET_INVALID");
    }

    const passwordHash = await PasswordService.hashPassword(input.new_password);

    await AuthRepository.resetPasswordAndRevokeSessions({
      userId: tokenRecord.user.id,
      tokenRecordId: tokenRecord.id,
      passwordHash,
      consumedAt: new Date(),
      revokedAt: new Date(),
    });

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
