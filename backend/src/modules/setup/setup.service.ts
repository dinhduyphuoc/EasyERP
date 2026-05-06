import type { UploadedFile } from "express-fileupload";
import { PasswordService } from "@/common/services/password.service";
import { BadRequestError, ConflictError } from "@/common/errors/app-error";
import { uploadStoreAvatarToS3 } from "@lib/s3";
import { prisma } from "@lib/prisma";
import { bootstrapRbac } from "@/modules/auth/rbac.bootstrap";
import { SetupRepository } from "./setup.repository";
import type { InitialSetupInput, InitialSetupResponse, SetupStatusResponse } from "./setup.types";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
]);

const DEFAULT_REDIRECT_PATH = "/";

const toTrimmedString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

const ensureEmail = (value: string) => {
  if (!value) {
    throw new BadRequestError("Email address is required");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new BadRequestError("Email address is invalid");
  }
};

const ensurePassword = (value: string) => {
  if (!value) {
    throw new BadRequestError("Password is required");
  }

  if (value.length < 8) {
    throw new BadRequestError("Password must be at least 8 characters");
  }
};

const ensureAllowedImage = (file: UploadedFile | null | undefined) => {
  if (!file) {
    return;
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestError("Only JPG and PNG images are supported");
  }
};

const ensureBaseSlug = (value: string, fallbackLabel: string) => {
  const slug = slugify(value);

  if (!slug) {
    throw new BadRequestError(`Unable to generate a valid slug from ${fallbackLabel}`);
  }

  return slug;
};

const buildUniqueSlug = async (
  baseSlug: string,
  exists: (slug: string) => Promise<{ id: string } | null>,
) => {
  let nextSlug = baseSlug;
  let suffix = 1;

  while (await exists(nextSlug)) {
    suffix += 1;
    nextSlug = `${baseSlug}-${suffix}`;
  }

  return nextSlug;
};

const getUploadedImageUrl = async (file: UploadedFile | null | undefined) => {
  if (!file) {
    return "";
  }

  ensureAllowedImage(file);
  const uploaded = await uploadStoreAvatarToS3({
    buffer: file.data,
    fileName: file.name,
    mimeType: file.mimetype,
  });

  return uploaded.image_url;
};

export const SetupService = {
  getStatus: async (): Promise<SetupStatusResponse> => {
    const counts = await SetupRepository.getSetupCounts();
    const hasFirstUser = counts.userCount > 0;
    const hasTenant = counts.tenantCount > 0;
    const hasStore = counts.storeCount > 0;
    const hasAdminUser = counts.adminUserCount > 0;

    return {
      setupCompleted: hasFirstUser && hasTenant && hasStore && hasAdminUser,
      hasFirstUser,
      hasAdminUser,
      hasTenant,
      hasStore,
    };
  },

  initialize: async (args: {
    input: InitialSetupInput;
    firstUserAvatar?: UploadedFile | null;
    companyLogo?: UploadedFile | null;
  }): Promise<InitialSetupResponse> => {
    await bootstrapRbac();

    const status = await SetupService.getStatus();

    if (status.setupCompleted) {
      throw new ConflictError("System setup has already been completed");
    }

    if (status.hasFirstUser || status.hasTenant || status.hasStore) {
      throw new ConflictError("System already contains partial setup data and cannot be initialized again");
    }

    const fullName = toTrimmedString(args.input.firstUser?.fullName);
    const email = toTrimmedString(args.input.firstUser?.email);
    const normalizedEmail = normalizeEmail(email);
    const password = typeof args.input.firstUser?.password === "string" ? args.input.firstUser.password : "";
    const companyName = toTrimmedString(args.input.company?.name);
    const companyAbbreviation = toTrimmedString(args.input.company?.abbreviation);

    if (!fullName) {
      throw new BadRequestError("Full name is required");
    }

    ensureEmail(email);
    ensurePassword(password);

    if (!companyName) {
      throw new BadRequestError("Company name is required");
    }

    ensureAllowedImage(args.firstUserAvatar);
    ensureAllowedImage(args.companyLogo);

    const [superAdminRole, passwordHash, avatarUrl, logoUrl] = await Promise.all([
      SetupRepository.findRoleBySlug("super_admin"),
      PasswordService.hashPassword(password),
      getUploadedImageUrl(args.firstUserAvatar),
      getUploadedImageUrl(args.companyLogo),
    ]);

    if (!superAdminRole) {
      throw new ConflictError("System RBAC roles are not ready. Please restart the backend and try again.");
    }

    await prisma.$transaction(async (tx) => {
      const tenantSlug = await buildUniqueSlug(
        ensureBaseSlug(companyAbbreviation || companyName, "company name"),
        (slug) => SetupRepository.findTenantBySlugTx(tx, slug),
      );
      const storeSlug = await buildUniqueSlug(
        ensureBaseSlug(companyName, "company name"),
        (slug) => SetupRepository.findStoreBySlugTx(tx, slug),
      );

      const createdTenant = await tx.tenant.create({
        data: {
          name: companyName,
          slug: tenantSlug,
        },
      });

      const createdUser = await tx.user.create({
        data: {
          tenant_id: createdTenant.id,
          full_name: fullName,
          email,
          email_normalized: normalizedEmail,
          avatar_url: avatarUrl,
          password_hash: passwordHash,
          status: "active",
          is_email_verified: true,
          roles: {
            create: {
              role_id: superAdminRole.id,
            },
          },
        },
      });

      const createdStore = await tx.store.create({
        data: {
          tenant_id: createdTenant.id,
          name: companyName,
          slug: storeSlug,
          owner_user_id: createdUser.id,
          default_currency: "USD",
          default_timezone: "Asia/Saigon",
          profile_json: {
            business_type: "company",
            legal_full_name: companyName,
            contact_email: email,
            contact_phone: "",
            avatar_url: logoUrl,
            store_name: companyName,
            brand_name: companyName,
            company_abbreviation: companyAbbreviation,
            owner_avatar_url: avatarUrl,
          },
        },
      });

      await tx.userStore.create({
        data: {
          user_id: createdUser.id,
          store_id: createdStore.id,
          role: "owner",
        },
      });

      await tx.user.update({
        where: {
          id: createdUser.id,
        },
        data: {
          active_store_id: createdStore.id,
        },
      });
    });

    return {
      success: true,
      setupCompleted: true,
      redirectTo: DEFAULT_REDIRECT_PATH,
      message: "Initial setup completed successfully",
    };
  },
};
