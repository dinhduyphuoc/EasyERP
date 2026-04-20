import "dotenv/config";
import { createServer } from "node:http";
import app from "@/app";

const port = Number(process.env.PORT ?? 3001);
const server = createServer(app);

server.listen(port, () => {
  console.log(`Backend server is running at http://localhost:${port}`);
});
