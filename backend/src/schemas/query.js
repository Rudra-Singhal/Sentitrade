const { z } = require("zod");
const { ASSETS } = require("../services/assetService");

const asset = z
  .string()
  .trim()
  .min(1)
  .max(10)
  .regex(/^[A-Za-z0-9]+$/, "asset must be alphanumeric")
  .transform((value) => value.toUpperCase())
  .refine((value) => Boolean(ASSETS[value]), {
    message: "unknown asset — see GET /api/v1/assets for the tracked list"
  })
  .default("BTC");

const range = z.enum(["5m", "1h", "24h"]).default("1h");

const sentimentQuery = z.object({
  asset,
  range,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  refresh: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true")
});

const trendQuery = z.object({ asset, range });

const correlationQuery = z.object({ asset, range });

module.exports = { sentimentQuery, trendQuery, correlationQuery };
