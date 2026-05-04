import { prisma } from "@lib/prisma";
import { PasswordService } from "@/common/services/password.service";
import { bootstrapRbac } from "@/modules/auth/rbac.bootstrap";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ADDRESS_SEED_SQL_PATH = path.join(__dirname, "..", "prisma", "seeds", "address_seed.sql");
const SQL_STATEMENT_MARKER = "-- @@statement@@";

const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME?.trim() || "Default Tenant";
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG?.trim() || "default";
const DEFAULT_STORE_NAME = process.env.DEFAULT_STORE_NAME?.trim() || "Default Store";
const DEFAULT_STORE_SLUG = process.env.DEFAULT_STORE_SLUG?.trim() || "default-store";
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || "";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD?.trim() || "";
const SUPER_ADMIN_FULL_NAME = process.env.SUPER_ADMIN_FULL_NAME?.trim() || "Super Admin";

function loadSeedStatements(filePath: string) {
  if (!existsSync(filePath)) {
    return [];
  }

  return readFileSync(filePath, "utf8")
    .split(SQL_STATEMENT_MARKER)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function ensureCoreSeed() {
  await bootstrapRbac();
  await ensureAddressSeed();

  const tenant = await ensureDefaultTenant();
  const superAdmin = await ensureSuperAdmin(tenant.id);

  if (!superAdmin) {
    return {
      tenant,
      store: null,
      superAdmin: null,
    };
  }

  const store = await ensureDefaultStore(superAdmin.id, tenant.id);

  return {
    tenant,
    store,
    superAdmin,
  };
}

export async function ensureAddressSeed() {
  const statements = loadSeedStatements(ADDRESS_SEED_SQL_PATH);

  if (statements.length === 0) {
    console.log("Address seed SQL not found. Skip address seed.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const statement of statements) {
      await tx.$executeRawUnsafe(statement);
    }
  });

  const [stateCount, cityCount, districtCount] = await Promise.all([
    prisma.state.count(),
    prisma.city.count(),
    prisma.district.count(),
  ]);

  console.log(
    `Address seed completed successfully. States: ${stateCount}, Cities: ${cityCount}, Districts: ${districtCount}`,
  );
}

export async function ensureDefaultTenant() {
  return prisma.tenant.upsert({
    where: {
      slug: DEFAULT_TENANT_SLUG,
    },
    update: {
      name: DEFAULT_TENANT_NAME,
      status: "active",
    },
    create: {
      name: DEFAULT_TENANT_NAME,
      slug: DEFAULT_TENANT_SLUG,
      status: "active",
    },
  });
}

export async function ensureSuperAdmin(tenantId: string) {
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    console.log(
      "SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is missing. Skip super admin seed.",
    );
    return null;
  }

  if (SUPER_ADMIN_PASSWORD.length < 8) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 8 characters");
  }

  const superAdminRole = await prisma.role.findFirst({
    where: {
      tenant_id: null,
      slug: "super_admin",
    },
    select: {
      id: true,
    },
  });

  if (!superAdminRole) {
    throw new Error("super_admin role is missing. Run RBAC bootstrap first.");
  }

  const passwordHash = await PasswordService.hashPassword(SUPER_ADMIN_PASSWORD);
  const existingUser = await prisma.user.findUnique({
    where: {
      email_normalized: SUPER_ADMIN_EMAIL,
    },
    select: {
      id: true,
    },
  });

  const user = existingUser
    ? await prisma.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          tenant_id: tenantId,
          full_name: SUPER_ADMIN_FULL_NAME,
          email: SUPER_ADMIN_EMAIL,
          email_normalized: SUPER_ADMIN_EMAIL,
          password_hash: passwordHash,
          status: "active",
          is_email_verified: true,
        },
      })
    : await prisma.user.create({
        data: {
          tenant_id: tenantId,
          full_name: SUPER_ADMIN_FULL_NAME,
          email: SUPER_ADMIN_EMAIL,
          email_normalized: SUPER_ADMIN_EMAIL,
          password_hash: passwordHash,
          status: "active",
          is_email_verified: true,
        },
      });

  await prisma.userRole.upsert({
    where: {
      user_id_role_id: {
        user_id: user.id,
        role_id: superAdminRole.id,
      },
    },
    update: {
      assigned_by: user.id,
    },
    create: {
      user_id: user.id,
      role_id: superAdminRole.id,
      assigned_by: user.id,
    },
  });

  await prisma.userScope.upsert({
    where: {
      user_id_tenant_id_scope_type_scope_value: {
        user_id: user.id,
        tenant_id: tenantId,
        scope_type: "tenant",
        scope_value: tenantId,
      },
    },
    update: {},
    create: {
      user_id: user.id,
      tenant_id: tenantId,
      scope_type: "tenant",
      scope_value: tenantId,
    },
  });

  console.log(`Super admin ready: ${SUPER_ADMIN_EMAIL}`);
  return user;
}

export async function ensureDefaultStore(userId: string, tenantId: string) {
  const existing = await prisma.store.findFirst({
    where: {
      owner_user_id: userId,
      deleted_at: null,
    },
  });

  const store = existing
    ? existing
    : await prisma.store.create({
        data: {
          name: DEFAULT_STORE_NAME,
          slug: DEFAULT_STORE_SLUG,
          owner_user_id: userId,
          tenant_id: tenantId,
          default_currency: "VND",
          default_timezone: "Asia/Saigon",
          user_stores: {
            create: {
              user_id: userId,
              role: "owner",
            },
          },
        },
      });

  await prisma.user.update({
    where: { id: userId },
    data: {
      active_store_id: store.id,
    },
  });

  return store;
}
