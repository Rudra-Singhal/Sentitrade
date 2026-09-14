const parseOrigins = () => {
  const raw = process.env.CLIENT_URL || process.env.FRONTEND_URL || "http://localhost:5173";

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const getAllowedOrigins = () => {
  const origins = parseOrigins();

  if (process.env.NODE_ENV !== "production") {
    return Array.from(new Set([...origins, "http://localhost:5173", "http://127.0.0.1:5173"]));
  }

  return origins;
};

const isPrivateNetworkHost = (hostname) => {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;

  return false;
};

const isOriginAllowed = (origin) => {
  if (!origin) return true;

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(origin)) return true;

  if (process.env.NODE_ENV === "production") return false;

  try {
    const url = new URL(origin);
    return url.protocol === "http:" && url.port === "5173" && isPrivateNetworkHost(url.hostname);
  } catch (_error) {
    return false;
  }
};

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

module.exports = { corsOptions, getAllowedOrigins, isOriginAllowed };
