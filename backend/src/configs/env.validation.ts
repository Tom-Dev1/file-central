import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),

  PORT: Joi.number().port().default(3000),

  API_PREFIX: Joi.string()
    .pattern(/^[a-z0-9-]+$/)
    .default("api"),

  CORS_ORIGINS: Joi.string().allow("").default("http://localhost:5173"),

  MONGODB_URI: Joi.string()
    .uri({
      scheme: ["mongodb", "mongodb+srv"],
    })
    .required(),

  MONGODB_MIN_POOL_SIZE: Joi.number().integer().min(0).default(2),

  MONGODB_MAX_POOL_SIZE: Joi.number().integer().min(1).default(20),

  MONGODB_AUTO_INDEX: Joi.boolean().default(true),

  LOG_LEVEL: Joi.string().valid("fatal", "error", "warn", "info", "debug", "trace").default("info"),

  LOG_PRETTY: Joi.boolean().default(true),

  MAX_FOLDER_DEPTH: Joi.number().integer().min(1).max(1024).default(256),
});
