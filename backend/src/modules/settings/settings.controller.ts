import type { Request, Response } from "express";
import { UnauthorizedError, BadRequestError } from "@/common";
import { SettingsService } from "./settings.service";
import type { UpdateGeneralSettingsInput, VietQrGenerateInput } from "./settings.types";

const parseBody = <T>(body: unknown) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestError("Request body is required");
  }

  return body as T;
};

export const SettingsController = {
  getGeneralSettings: async (req: Request, res: Response) => {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    const data = await SettingsService.getGeneralSettings(
      req.auth.user.tenant_id,
      req.auth.user.active_store_id,
    );
    return res.status(200).json(data);
  },

  updateGeneralSettings: async (
    req: Request<{}, {}, UpdateGeneralSettingsInput>,
    res: Response,
  ) => {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    const data = await SettingsService.updateGeneralSettings(
      req.auth.user.tenant_id,
      req.auth.user.active_store_id,
      parseBody<UpdateGeneralSettingsInput>(req.body),
    );

    return res.status(200).json(data);
  },

  getVietQrBanks: async (_req: Request, res: Response) => {
    const data = await SettingsService.getVietQrBanks();
    return res.status(200).json(data);
  },

  getVietQrTemplates: async (_req: Request, res: Response) => {
    const data = await SettingsService.getVietQrTemplates();
    return res.status(200).json(data);
  },

  generateVietQr: async (
    req: Request<{}, {}, VietQrGenerateInput>,
    res: Response,
  ) => {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as VietQrGenerateInput)
        : {};

    const data = await SettingsService.generateVietQr(req.auth.user.tenant_id, body);
    return res.status(200).json(data);
  },
};
