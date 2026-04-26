import { Router } from "express";
import { authenticate } from "@/common/middleware/authenticate";
import { AuthController } from "./auth.controller";

const authRouter = Router();

authRouter.post("/login", AuthController.login);
authRouter.post("/forgot-password", AuthController.forgotPassword);
authRouter.post("/reset-password", AuthController.resetPassword);
authRouter.get("/me", authenticate, AuthController.me);
authRouter.post("/logout", authenticate, AuthController.logout);

export { authRouter };
