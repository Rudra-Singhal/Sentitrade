import { io } from "socket.io-client";

const getDefaultSocketUrl = () => {
  if (typeof window === "undefined") return "http://localhost:3000";
  return `${window.location.protocol}//${window.location.hostname}:3000`;
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || getDefaultSocketUrl();

export const createSocket = () =>
  io(SOCKET_URL, {
    // Render supports websocket upgrades; keep polling only as a dev fallback.
    transports: import.meta.env.PROD ? ["websocket"] : ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1200
  });
