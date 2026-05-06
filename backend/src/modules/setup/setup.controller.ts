import type { Request, Response } from "express";
import type { UploadedFile } from "express-fileupload";
import { BadRequestError } from "@/common/errors/app-error";
import { SetupService } from "./setup.service";
import type { InitialSetupInput } from "./setup.types";

const parseMultipartJsonField = <T>(value: unknown, fieldName: string): T => {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestError(`${fieldName} is required`);
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    throw new BadRequestError(`${fieldName} must be valid JSON`);
  }
};

const toOptionalUpload = (value: unknown): UploadedFile | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    throw new BadRequestError("Only one file is allowed for each upload field");
  }

  return value as UploadedFile;
};

export const SetupController = {
  getStatus: async (_req: Request, res: Response) => {
    const status = await SetupService.getStatus();
    return res.status(200).json(status);
  },

  initialize: async (req: Request, res: Response) => {
    const input = parseMultipartJsonField<InitialSetupInput>(req.body.payload, "payload");
    const result = await SetupService.initialize({
      input,
      firstUserAvatar: toOptionalUpload(req.files?.firstUserAvatar),
      companyLogo: toOptionalUpload(req.files?.companyLogo),
    });

    return res.status(201).json(result);
  },
};
