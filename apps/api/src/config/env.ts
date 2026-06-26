import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const envPaths = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];
for (const path of envPaths) {
  if (existsSync(path)) {
    dotenv.config({ path });
    break;
  }
}

if (!process.env.API_PORT && process.env.PORT) {
  process.env.API_PORT = process.env.PORT;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  WEB_URL: z.string().min(1).default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(24),
  PLATFORM_ADMIN_EMAIL: z.string().email().default("admin@bakersmania.local"),
  REDIS_URL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional()
});

export const env = envSchema.parse(process.env);
