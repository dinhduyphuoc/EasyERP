import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 48;

export const SessionTokenService = {
  generateToken: () => randomBytes(TOKEN_BYTES).toString("base64url"),

  hashToken: (token: string) =>
    createHash("sha256").update(token, "utf8").digest("hex"),
};
