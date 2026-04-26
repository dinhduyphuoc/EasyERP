import type { Request, Response } from "express";
import { BadRequestError } from "@/common";
import { RbacService } from "./rbac.service";

const parseBody = <T>(body: unknown) => {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body is required");
  }

  return body as T;
};

type CreateRoleBody = {
  slug: string;
  name: string;
  description?: string | null;
  permission_codes: string[];
};

type UpdateRoleBody = {
  name: string;
  description?: string | null;
  permission_codes: string[];
};

export const RbacController = {
  listRoles: async (_req: Request, res: Response) => {
    const result = await RbacService.listRoles();
    return res.status(200).json(result);
  },

  createRole: async (req: Request<{}, {}, CreateRoleBody>, res: Response) => {
    const payload = parseBody<CreateRoleBody>(req.body);
    const result = await RbacService.createRole(payload);
    return res.status(201).json(result);
  },

  updateRole: async (req: Request<{ id: string }, {}, UpdateRoleBody>, res: Response) => {
    const payload = parseBody<UpdateRoleBody>(req.body);
    const result = await RbacService.updateRole(req.params.id, payload);
    return res.status(200).json(result);
  },

  deleteRole: async (req: Request<{ id: string }>, res: Response) => {
    const result = await RbacService.deleteRole(req.params.id);
    return res.status(200).json(result);
  },

  listPermissions: async (_req: Request, res: Response) => {
    const result = await RbacService.listPermissions();
    return res.status(200).json(result);
  },
};
