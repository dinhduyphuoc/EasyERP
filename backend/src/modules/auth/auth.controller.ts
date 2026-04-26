import type { Request, Response } from "express";
import { BadRequestError, UnauthorizedError } from "@/common";
import { AuthService } from "./auth.service";

const parseBody = <T>(body: unknown) => {
  if (!body || typeof body !== "object") {
    throw new BadRequestError("Request body is required");
  }

  return body as T;
};

const getClientIp = (req: Request) =>
  req.ip || req.socket.remoteAddress || null;

const getBearerToken = (req: Request) => {
  const header = req.header("authorization");

  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
};

type LoginBody = {
  email: string;
  password: string;
};

type ForgotPasswordBody = {
  email: string;
};

type ResetPasswordBody = {
  token: string;
  new_password: string;
};

export const AuthController = {
  login: async (req: Request<{}, {}, LoginBody>, res: Response) => {
    const payload = parseBody<LoginBody>(req.body);
    const result = await AuthService.login({
      email: payload.email,
      password: payload.password,
      ip_address: getClientIp(req),
      user_agent: req.header("user-agent"),
      request_id: req.header("x-request-id"),
    });

    return res.status(200).json(result);
  },

  logout: async (req: Request, res: Response) => {
    const token = getBearerToken(req);

    if (!token || !req.auth) {
      throw new UnauthorizedError();
    }

    await AuthService.logout(token, {
      actor_user_id: req.auth.user.id,
      ip_address: getClientIp(req),
      user_agent: req.header("user-agent"),
      request_id: req.header("x-request-id"),
    });

    return res.status(200).json({
      message: "Logged out successfully.",
    });
  },

  me: async (req: Request, res: Response) => {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    const me = await AuthService.getMe(req.auth.user.id);
    return res.status(200).json(me);
  },

  forgotPassword: async (
    req: Request<{}, {}, ForgotPasswordBody>,
    res: Response,
  ) => {
    const payload = parseBody<ForgotPasswordBody>(req.body);
    const result = await AuthService.forgotPassword({
      email: payload.email,
      ip_address: getClientIp(req),
      user_agent: req.header("user-agent"),
      request_id: req.header("x-request-id"),
    });

    return res.status(200).json(result);
  },

  resetPassword: async (
    req: Request<{}, {}, ResetPasswordBody>,
    res: Response,
  ) => {
    const payload = parseBody<ResetPasswordBody>(req.body);
    const result = await AuthService.resetPassword({
      token: payload.token,
      new_password: payload.new_password,
      ip_address: getClientIp(req),
      user_agent: req.header("user-agent"),
      request_id: req.header("x-request-id"),
    });

    return res.status(200).json(result);
  },
};
