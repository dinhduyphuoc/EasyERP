import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { createPrismaPgAdapter } from "./database";

const adapter = createPrismaPgAdapter();

export const prisma = new PrismaClient({ adapter });
