const { Server } = require("socket.io");
const { z } = require("zod");
const { getSnapshot } = require("./snapshotService");
const { isOriginAllowed } = require("../config/cors");
const activeAssets = require("../jobs/activeAssets");
const { ingestNow } = require("../jobs/scheduler");
const logger = require("../config/logger");
const { errInfo } = logger;

const BROADCAST_MS = 30_000;

const changeSchema = z.object({
  asset: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/)
    .transform((v) => v.toUpperCase())
    .optional(),
  range: z.enum(["5m", "1h", "24h"]).optional()
});

const roomKey = (asset, range) => `${asset}:${range}`;
const isRoomKey = (name) => name.includes(":");

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (isOriginAllowed(origin)) return callback(null, true);
        callback(new Error(`Socket CORS blocked origin: ${origin}`));
      },
      methods: ["GET", "POST"]
    }
  });

  const sendSnapshot = async (target, asset, range, opts) => {
    try {
      target.emit("sentiment:update", await getSnapshot(asset, range, opts));
    } catch (err) {
      logger.warn({ asset, range, err: errInfo(err) }, "socket snapshot failed");
      if (target.emit) target.emit("sentiment:error", "Unable to build market snapshot");
    }
  };

  io.on("connection", (socket) => {
    const state = { asset: "BTC", range: "24h" };
    socket.join(roomKey(state.asset, state.range));
    activeAssets.track(state.asset);
    sendSnapshot(socket, state.asset, state.range);

    socket.on("asset:change", (payload) => {
      const parsed = changeSchema.safeParse(payload || {});
      if (!parsed.success) {
        socket.emit("sentiment:error", "Invalid asset:change payload");
        return;
      }

      const prev = { ...state };
      if (parsed.data.asset) state.asset = parsed.data.asset;
      if (parsed.data.range) state.range = parsed.data.range;

      if (prev.asset !== state.asset || prev.range !== state.range) {
        socket.leave(roomKey(prev.asset, prev.range));
        socket.join(roomKey(state.asset, state.range));
      }
      if (prev.asset !== state.asset) {
        activeAssets.untrack(prev.asset);
        activeAssets.track(state.asset);
        // Warm a not-yet-tracked asset, then push a fresh snapshot when it lands
        // (avoids leaving the user on a "simulated" view for up to a broadcast).
        ingestNow(state.asset)
          .then(() => {
            if (state.asset === parsed.data.asset || !parsed.data.asset) {
              sendSnapshot(socket, state.asset, state.range, { fresh: true });
            }
          })
          .catch(() => {});
      }

      sendSnapshot(socket, state.asset, state.range);
    });

    socket.on("disconnect", () => activeAssets.untrack(state.asset));
  });

  // One server-wide broadcaster: compute each active room's snapshot once,
  // fan it out. Replaces the old per-connection 30s timer.
  const broadcast = async () => {
    const rooms = io.sockets.adapter.rooms;
    for (const [room, members] of rooms) {
      if (!isRoomKey(room) || members.size === 0) continue;
      const [asset, range] = room.split(":");
      try {
        io.to(room).emit("sentiment:update", await getSnapshot(asset, range, { fresh: true }));
      } catch (err) {
        logger.warn({ room, err: errInfo(err) }, "broadcast failed");
      }
    }
  };

  const timer = setInterval(broadcast, BROADCAST_MS);
  timer.unref?.();
  io.stopBroadcast = () => clearInterval(timer);

  return io;
};

module.exports = initSocket;
