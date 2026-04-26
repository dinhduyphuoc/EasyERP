import { prisma } from "@lib/prisma";
import { Prisma } from "../../../generated/prisma/client";

type AuditLogInput = {
  tenant_id?: string | null;
  actor_user_id?: string | null;
  target_user_id?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  status: string;
  ip_address?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
  metadata_json?: Record<string, unknown>;
};

export const AuditLogService = {
  write: async (input: AuditLogInput) => {
    return prisma.auditLog.create({
      data: {
        tenant_id: input.tenant_id ?? null,
        actor_user_id: input.actor_user_id ?? null,
        target_user_id: input.target_user_id ?? null,
        action: input.action,
        resource_type: input.resource_type,
        resource_id: input.resource_id ?? null,
        status: input.status,
        ip_address: input.ip_address ?? null,
        user_agent: input.user_agent ?? null,
        request_id: input.request_id ?? null,
        metadata_json: (input.metadata_json ?? {}) as Prisma.InputJsonObject,
      },
    });
  },
};
