require("dotenv").config();

const { z } = require("zod");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  CLIENT_URL: z.string().optional(),
  FRONTEND_URL: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  NEWS_API_KEY: z.string().optional(),
  FINNHUB_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  // Live price providers (Binance/Yahoo, both key-free) are ON by default.
  // Set to "false" only as a kill switch.
  ENABLE_LIVE_PRICE_API: z.enum(["true", "false"]).default("true"),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info")
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Logger is not available yet — this is a boot-time fatal.
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;
const isProd = env.NODE_ENV === "production";
const isTest = env.NODE_ENV === "test";
const isDev = !isProd && !isTest;

if (isProd) {
  const missing = [];
  if (!env.MONGODB_URI) missing.push("MONGODB_URI");
  if (!env.CLIENT_URL && !env.FRONTEND_URL) missing.push("CLIENT_URL or FRONTEND_URL");

  if (missing.length) {
    console.error(`Missing required production environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}

module.exports = {
  env,
  isProd,
  isTest,
  isDev,
  livePriceEnabled: env.ENABLE_LIVE_PRICE_API !== "false"
};
