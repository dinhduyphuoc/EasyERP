import argon2 from "argon2";

const ARGON2_MEMORY_COST = 64 * 1024;
const ARGON2_TIME_COST = 3;
const ARGON2_PARALLELISM = 1;

export const PasswordService = {
  hashPassword: async (password: string) => {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: ARGON2_MEMORY_COST,
      timeCost: ARGON2_TIME_COST,
      parallelism: ARGON2_PARALLELISM,
    });
  },

  verifyPassword: async (passwordHash: string, password: string) => {
    return argon2.verify(passwordHash, password);
  },
};
