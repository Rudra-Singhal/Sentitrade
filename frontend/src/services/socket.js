import { io } from "socket.io-client";

const getDefaultSocketUrl = () => {
  if (typeof window === "undefined") return "http://localhost:3000";

  return `${window.location.protocol}//${window.location.hostname}:3000`;
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || getDefaultSocketUrl();

export const createSocket = () =>
  io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1200
  });
