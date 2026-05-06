import "dotenv/config";
import { createServer } from "node:http";
import app from "@/app";
import { prisma } from "@lib/prisma";
import { cache } from "@lib/cache";
import { bootstrapRbac } from "@/modules/auth/rbac.bootstrap";

const port = Number(process.env.PORT ?? 3001);
const server = createServer(app);

const startServer = async () => {
  try {
    await prisma.$connect();
    await cache.connect();
    await bootstrapRbac();
    console.log("Database connection succeeded.");
    server.listen(port, () => {
      console.log(`Backend server is running at http://localhost:${port}`);
    });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    console.error("Database connection failed.");
    console.error(`Code: ${err.code ?? "UNKNOWN"}`);
    console.error(`Message: ${err.message}`);
    await cache.disconnect().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Shutting down backend.`);
  await cache.disconnect();
  await prisma.$disconnect();
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void startServer();
