import { registerAs } from "@nestjs/config";

export const loggingConfig = registerAs("logging", () => ({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  pretty:
    process.env.LOG_PRETTY !== undefined ? process.env.LOG_PRETTY === "true" : process.env.NODE_ENV !== "production",
}));
