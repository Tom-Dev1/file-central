import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),

  PORT: Joi.number().port().default(3000),

  API_PREFIX: Joi.string()
    .pattern(/^[a-z0-9-]+$/)
    .default("api"),

  CORS_ORIGINS: Joi.string()
    .allow("")
    .default("http://localhost:3030,http://localhost:5173"),

  MONGODB_URI: Joi.string()
    .uri({
      scheme: ["mongodb", "mongodb+srv"],
    })
    .required(),

  MONGODB_MIN_POOL_SIZE: Joi.number().integer().min(0).default(2),

  MONGODB_MAX_POOL_SIZE: Joi.number().integer().min(1).default(20),

  MONGODB_AUTO_INDEX: Joi.boolean().default(true),

  JWT_SECRET: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().min(16).default("development-only-secret"),
  }),

  JWT_EXPIRES_IN: Joi.string().default("15m"),

  REFRESH_TOKEN_EXPIRES_IN_DAYS: Joi.number().integer().min(1).default(30),

  STORAGE_ENDPOINT: Joi.string().uri().optional(),

  STORAGE_REGION: Joi.string().default("us-east-1"),

  STORAGE_ACCESS_KEY: Joi.string().optional(),

  STORAGE_SECRET_KEY: Joi.string().optional(),

  STORAGE_BUCKET: Joi.string().min(3).optional(),

  STORAGE_FORCE_PATH_STYLE: Joi.boolean().default(true),

  STORAGE_PRESIGN_EXPIRES_SECONDS: Joi.number().integer().min(60).max(86400).default(3600),

  LOG_LEVEL: Joi.string().valid("fatal", "error", "warn", "info", "debug", "trace").default("info"),

  LOG_PRETTY: Joi.boolean().default(true),

  MAX_FOLDER_DEPTH: Joi.number().integer().min(1).max(1024).default(256),
});
