import type { NextFunction, Request, Response } from "express";
import { AppError } from "@/common/errors/app-error";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code ?? "APP_ERROR",
        message: err.message,
        request_id: req.header("x-request-id") ?? null,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  console.error("Unexpected error:", err);
  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
      request_id: req.header("x-request-id") ?? null,
    },
  });
};
