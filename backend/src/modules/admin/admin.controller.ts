import type { Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "@/common";
import { AdminService } from "./admin.service";

const parseBody = <T>(body: unknown) => {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body is required");
  }

  return body as T;
};

const getClientIp = (req: Request) => req.ip || req.socket.remoteAddress || null;

type CreateUserBody = {
  full_name: string;
  email: string;
  password: string;
  role_slugs: string[];
  tenant_id?: string | null;
};

type AssignRolesBody = {
  role_slugs: string[];
};

type UpdateStatusBody = {
  status: "active" | "blocked" | "inactive";
};

export const AdminController = {
  listUsers: async (req: Request, res: Response) => {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    const result = await AdminService.listUsers();
    return res.status(200).json(result);
  },

  createUser: async (req: Request<{}, {}, CreateUserBody>, res: Response) => {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    const payload = parseBody<CreateUserBody>(req.body);
    const result = await AdminService.createUser({
      actor_user_id: req.auth.user.id,
      actor_roles: req.auth.user.roles,
      full_name: payload.full_name,
      email: payload.email,
      password: payload.password,
      role_slugs: payload.role_slugs,
      tenant_id: payload.tenant_id,
      request_id: req.header("x-request-id"),
      ip_address: getClientIp(req),
      user_agent: req.header("user-agent"),
    });

    return res.status(201).json(result);
  },

  assignRoles: async (
    req: Request<{ id: string }, {}, AssignRolesBody>,
    res: Response,
  ) => {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    const payload = parseBody<AssignRolesBody>(req.body);
    const result = await AdminService.assignRoles({
      actor_user_id: req.auth.user.id,
      actor_roles: req.auth.user.roles,
      target_user_id: req.params.id,
      role_slugs: payload.role_slugs,
      request_id: req.header("x-request-id"),
      ip_address: getClientIp(req),
      user_agent: req.header("user-agent"),
    });

    return res.status(200).json(result);
  },

  updateStatus: async (
    req: Request<{ id: string }, {}, UpdateStatusBody>,
    res: Response,
  ) => {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    const payload = parseBody<UpdateStatusBody>(req.body);
    const result = await AdminService.updateStatus({
      actor_user_id: req.auth.user.id,
      target_user_id: req.params.id,
      status: payload.status,
      request_id: req.header("x-request-id"),
      ip_address: getClientIp(req),
      user_agent: req.header("user-agent"),
    });

    return res.status(200).json(result);
  },
};
