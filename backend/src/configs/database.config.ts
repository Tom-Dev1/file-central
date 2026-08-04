import { registerAs } from "@nestjs/config";

export const databaseConfig = registerAs("database", () => ({
  uri: process.env.MONGODB_URI ?? "mongodb://localhost:27019/file-central",
  minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE ?? 2),
  maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE ?? 20),
  autoIndex: process.env.MONGODB_AUTO_INDEX === "true",
}));
