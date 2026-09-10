const { Server } = require("socket.io");
const { getLatestSentiment } = require("./newsService");
const { getCorrelationInsight } = require("./correlationService");
const { createMarketSummary } = require("./summaryService");
const { generateTradeSignal } = require("./signalService");
const { isOriginAllowed } = require("../config/cors");

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

  const emitSnapshot = async (socketOrServer, { asset = "BTC", range = "1h" } = {}) => {
    const sentiment = await getLatestSentiment(asset, 20, true);
    const correlation = await getCorrelationInsight(asset, range);
    const signal = generateTradeSignal({ sentiment, correlation });

    socketOrServer.emit("sentiment:update", {
      sentiment: {
        ...sentiment,
        signal,
        summary: createMarketSummary({ sentiment, correlation })
      },
      correlation: {
        ...correlation,
        signal
      }
    });
  };

  io.on("connection", (socket) => {
    const state = { asset: "BTC", range: "1h" };

    emitSnapshot(socket, state).catch((error) => socket.emit("sentiment:error", error.message));

    socket.on("asset:change", (payload = {}) => {
      state.asset = payload.asset || state.asset;
      state.range = payload.range || state.range;
      emitSnapshot(socket, state).catch((error) => socket.emit("sentiment:error", error.message));
    });

    const interval = setInterval(() => {
      emitSnapshot(socket, state).catch((error) => socket.emit("sentiment:error", error.message));
    }, 30000);

    socket.on("disconnect", () => clearInterval(interval));
  });

  return io;
};

module.exports = initSocket;
