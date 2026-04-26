import "dotenv/config";
import { createServer } from "node:http";
import app from "@/app";
import { prisma } from "@lib/prisma";
import { bootstrapRbac } from "@/modules/auth/rbac.bootstrap";

const port = Number(process.env.PORT ?? 3001);
const server = createServer(app);

const startServer = async () => {
  try {
    await prisma.$connect();
    await bootstrapRbac();
    console.log("Database connection succeeded.");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    console.error("Database connection failed.");
    console.error(`Code: ${err.code ?? "UNKNOWN"}`);
    console.error(`Message: ${err.message}`);
  }

  server.listen(port, () => {
    console.log(`Backend server is running at http://localhost:${port}`);
  });
};

void startServer();
