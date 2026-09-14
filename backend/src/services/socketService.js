const { Server } = require("socket.io");
const { z } = require("zod");
const { getLatestSentiment } = require("./newsService");
const { getCorrelationInsight } = require("./correlationService");
const { createMarketSummary } = require("./summaryService");
const { generateTradeSignal } = require("./signalService");
const { isOriginAllowed } = require("../config/cors");
const logger = require("../config/logger");
const { errInfo } = logger;

const changeSchema = z.object({
  asset: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/)
    .transform((value) => value.toUpperCase())
    .optional(),
  range: z.enum(["5m", "1h", "24h"]).optional()
});

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Socket CORS blocked origin: ${origin}`));
      },
      methods: ["GET", "POST"]
    }
  });

  const emitSnapshot = async (target, { asset = "BTC", range = "1h" } = {}) => {
    const sentiment = await getLatestSentiment(asset, 20, true);
    const correlation = await getCorrelationInsight(asset, range);
    const signal = generateTradeSignal({ sentiment, correlation });

    target.emit("sentiment:update", {
      sentiment: {
        ...sentiment,
        signal,
        summary: createMarketSummary({ sentiment, correlation })
      },
      correlation: { ...correlation, signal }
    });
  };

  io.on("connection", (socket) => {
    const state = { asset: "BTC", range: "1h" };

    const safeEmit = () =>
      emitSnapshot(socket, state).catch((err) => {
        logger.warn({ err: errInfo(err) }, "socket snapshot failed");
        socket.emit("sentiment:error", "Unable to build market snapshot");
      });

    safeEmit();

    socket.on("asset:change", (payload) => {
      const parsed = changeSchema.safeParse(payload || {});
      if (!parsed.success) {
        socket.emit("sentiment:error", "Invalid asset:change payload");
        return;
      }
      if (parsed.data.asset) state.asset = parsed.data.asset;
      if (parsed.data.range) state.range = parsed.data.range;
      safeEmit();
    });

    const interval = setInterval(safeEmit, 30000);
    socket.on("disconnect", () => clearInterval(interval));
  });

  return io;
};

module.exports = initSocket;
