import { prisma } from "@lib/prisma";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/common";

const normalizeRoleSlug = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "_");

const validateRoleInput = (input: {
  slug: string;
  name: string;
  description?: string | null;
  permission_codes: string[];
}) => {
  const slug = normalizeRoleSlug(input.slug);
  const name = input.name.trim();
  const permissionCodes = [...new Set(input.permission_codes.map((code) => code.trim()).filter(Boolean))];

  if (!slug) {
    throw new BadRequestError("slug is required");
  }

  if (!/^[a-z0-9_]+$/.test(slug)) {
    throw new BadRequestError("slug may only contain lowercase letters, numbers and underscores");
  }

  if (!name) {
    throw new BadRequestError("name is required");
  }

  if (permissionCodes.length === 0) {
    throw new BadRequestError("At least one permission is required");
  }

  return {
    slug,
    name,
    description: input.description?.trim() || null,
    permission_codes: permissionCodes,
  };
};

const getPermissionsByCodes = async (permissionCodes: string[]) => {
  const permissions = await prisma.permission.findMany({
    where: {
      code: {
        in: permissionCodes,
      },
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (permissions.length !== permissionCodes.length) {
    throw new BadRequestError("One or more permissions are invalid");
  }

  return permissions;
};

const toRoleSummary = (role: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: Array<{
    permission: {
      code: string;
      description: string | null;
    };
  }>;
}) => ({
  id: role.id,
  slug: role.slug,
  name: role.name,
  description: role.description,
  is_system: role.is_system,
  permissions: role.permissions.map((item) => item.permission),
});

export const RbacService = {
  listRoles: async () => {
    const roles = await prisma.role.findMany({
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
    });

    return {
      items: roles.map((role) => toRoleSummary(role)),
    };
  },

  createRole: async (input: {
    slug: string;
    name: string;
    description?: string | null;
    permission_codes: string[];
  }) => {
    const payload = validateRoleInput(input);
    const existingRole = await prisma.role.findFirst({
      where: {
        tenant_id: null,
        slug: payload.slug,
      },
      select: {
        id: true,
      },
    });

    if (existingRole) {
      throw new ConflictError(`Role "${payload.slug}" already exists`);
    }

    const permissions = await getPermissionsByCodes(payload.permission_codes);

    const role = await prisma.role.create({
      data: {
        tenant_id: null,
        slug: payload.slug,
        name: payload.name,
        description: payload.description,
        is_system: false,
        permissions: {
          create: permissions.map((permission) => ({
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
    });

    return toRoleSummary(role);
  },

  updateRole: async (id: string, input: {
    name: string;
    description?: string | null;
    permission_codes: string[];
  }) => {
    const existingRole = await prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        is_system: true,
      },
    });

    if (!existingRole) {
      throw new NotFoundError("Role not found");
    }

    if (existingRole.is_system) {
      throw new ForbiddenError("System roles are read-only");
    }

    const name = input.name.trim();
    const permissionCodes = [...new Set(input.permission_codes.map((code) => code.trim()).filter(Boolean))];

    if (!name) {
      throw new BadRequestError("name is required");
    }

    if (permissionCodes.length === 0) {
      throw new BadRequestError("At least one permission is required");
    }

    const permissions = await getPermissionsByCodes(permissionCodes);

    const role = await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          name,
          description: input.description?.trim() || null,
        },
      });

      await tx.rolePermission.deleteMany({
        where: {
          role_id: id,
        },
      });

      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({
          role_id: id,
          permission_id: permission.id,
        })),
      });

      return tx.role.findUniqueOrThrow({
        where: { id },
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
    });

    return toRoleSummary(role);
  },

  deleteRole: async (id: string) => {
    const existingRole = await prisma.role.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            user_id: true,
          },
        },
      },
    });

    if (!existingRole) {
      throw new NotFoundError("Role not found");
    }

    if (existingRole.is_system) {
      throw new ForbiddenError("System roles cannot be deleted");
    }

    if (existingRole.users.length > 0) {
      throw new ConflictError("Role is still assigned to one or more users");
    }

    await prisma.role.delete({
      where: { id },
    });

    return { deleted: true, id };
  },

  listPermissions: async () => {
    const permissions = await prisma.permission.findMany({
      orderBy: [
        {
          code: "asc",
        },
      ],
    });

    return {
      items: permissions,
    };
  },
};
