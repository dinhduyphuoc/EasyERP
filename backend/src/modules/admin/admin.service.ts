import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/common";
import { AuditLogService } from "@/common/services/audit-log.service";
import { PasswordService } from "@/common/services/password.service";
import { AdminRepository } from "./admin.repository";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const RESERVED_ADMIN_ROLES = new Set(["admin", "super_admin"]);

const toUserSummary = (user: {
  id: string;
  tenant_id: string | null;
  full_name: string;
  email: string;
  status: string;
  is_email_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  roles: Array<{
    role: {
      slug: string;
      name: string;
    };
  }>;
  scopes?: Array<{
    scope_type: string;
    scope_value: string;
  }>;
}) => ({
  id: user.id,
  tenant_id: user.tenant_id,
  full_name: user.full_name,
  email: user.email,
  status: user.status,
  is_email_verified: user.is_email_verified,
  last_login_at: user.last_login_at?.toISOString() ?? null,
  created_at: user.created_at.toISOString(),
  updated_at: user.updated_at.toISOString(),
  roles: user.roles.map((item) => ({
    slug: item.role.slug,
    name: item.role.name,
  })),
  scopes:
    user.scopes?.map((scope) => ({
      scope_type: scope.scope_type,
      scope_value: scope.scope_value,
    })) ?? [],
});

const ensureActorCanAssignRoles = (actorRoles: string[], targetRoles: string[]) => {
  const actorIsSuperAdmin = actorRoles.includes("super_admin");

  if (actorIsSuperAdmin) {
    return;
  }

  if (targetRoles.some((role) => RESERVED_ADMIN_ROLES.has(role))) {
    throw new ForbiddenError(
      "Only super_admin can assign admin or super_admin roles",
      {
        attempted_roles: targetRoles,
      },
    );
  }
};

const getRolesBySlugs = async (roleSlugs: string[]) => {
  const uniqueRoleSlugs = [...new Set(roleSlugs)];

  if (uniqueRoleSlugs.length === 0) {
    throw new BadRequestError("At least one role is required");
  }

  const roles = await AdminRepository.findRolesBySlugs(uniqueRoleSlugs);

  if (roles.length !== uniqueRoleSlugs.length) {
    throw new BadRequestError("One or more roles are invalid");
  }

  return roles;
};

export const AdminService = {
  listUsers: async () => {
    const users = await AdminRepository.findAllUsersWithSummary();

    return {
      items: users.map((user) => toUserSummary(user)),
    };
  },

  createUser: async (input: {
    actor_user_id: string;
    actor_roles: string[];
    full_name: string;
    email: string;
    password: string;
    role_slugs: string[];
    tenant_id?: string | null;
    request_id?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
  }) => {
    const email = normalizeEmail(input.email);
    ensureActorCanAssignRoles(input.actor_roles, input.role_slugs);

    const existingUser = await AdminRepository.findUserIdByNormalizedEmail(email);

    if (existingUser) {
      throw new ConflictError("Email is already in use");
    }

    if (input.password.length < 8) {
      throw new BadRequestError("Password must be at least 8 characters");
    }

    const roles = await getRolesBySlugs(input.role_slugs);
    const passwordHash = await PasswordService.hashPassword(input.password);

    const user = await AdminRepository.createUserWithRoles({
      tenantId: input.tenant_id ?? null,
      fullName: input.full_name.trim(),
      email,
      passwordHash,
      actorUserId: input.actor_user_id,
      roles,
    });

    await AuditLogService.write({
      tenant_id: user.tenant_id,
      actor_user_id: input.actor_user_id,
      target_user_id: user.id,
      action: "admin.user_created",
      resource_type: "user",
      resource_id: user.id,
      status: "success",
      request_id: input.request_id,
      ip_address: input.ip_address,
      user_agent: input.user_agent,
      metadata_json: {
        role_slugs: input.role_slugs,
      },
    });

    return toUserSummary(user);
  },

  assignRoles: async (input: {
    actor_user_id: string;
    actor_roles: string[];
    target_user_id: string;
    role_slugs: string[];
    request_id?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
  }) => {
    ensureActorCanAssignRoles(input.actor_roles, input.role_slugs);

    const user = await AdminRepository.findUserTenantById(input.target_user_id);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const roles = await getRolesBySlugs(input.role_slugs);

    await AdminRepository.replaceUserRoles({
      userId: user.id,
      actorUserId: input.actor_user_id,
      roles,
    });

    await AuditLogService.write({
      tenant_id: user.tenant_id,
      actor_user_id: input.actor_user_id,
      target_user_id: user.id,
      action: "admin.user_roles_updated",
      resource_type: "user",
      resource_id: user.id,
      status: "success",
      request_id: input.request_id,
      ip_address: input.ip_address,
      user_agent: input.user_agent,
      metadata_json: {
        role_slugs: input.role_slugs,
      },
    });

    return AdminRepository.findUserSummaryByIdOrThrow(user.id).then((updatedUser) => toUserSummary(updatedUser));
  },

  updateStatus: async (input: {
    actor_user_id: string;
    target_user_id: string;
    status: "active" | "blocked" | "inactive";
    request_id?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
  }) => {
    const user = await AdminRepository.findUserTenantById(input.target_user_id);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const updatedUser = await AdminRepository.updateUserStatus({
      userId: user.id,
      status: input.status,
      lockedUntil: input.status === "blocked" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null,
    });

    if (input.status !== "active") {
      await AdminRepository.revokeActiveSessionsByUserId({
        userId: user.id,
        revokedAt: new Date(),
        revokeReason: `user_${input.status}`,
      });
    }

    await AuditLogService.write({
      tenant_id: user.tenant_id,
      actor_user_id: input.actor_user_id,
      target_user_id: user.id,
      action: "admin.user_status_updated",
      resource_type: "user",
      resource_id: user.id,
      status: "success",
      request_id: input.request_id,
      ip_address: input.ip_address,
      user_agent: input.user_agent,
      metadata_json: {
        next_status: input.status,
      },
    });

    return toUserSummary(updatedUser);
  },
};
