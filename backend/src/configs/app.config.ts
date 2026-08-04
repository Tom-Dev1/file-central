import { registerAs } from "@nestjs/config";

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
export const appConfig = registerAs("app", () => ({
  name: "file-central-api",
  environment: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? "api",
  corsOrigins: parseCsv(process.env.CORS_ORIGINS),
  maxFolderDepth: Number(process.env.MAX_FOLDER_DEPTH ?? 256),
}));
