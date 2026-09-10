import axios from "axios";

const getDefaultApiUrl = () => {
  if (typeof window === "undefined") return "http://localhost:3000/api/v1";

  return `${window.location.protocol}//${window.location.hostname}:3000/api/v1`;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || getDefaultApiUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000
});

export const fetchSentiment = (asset, range) =>
  api.get("/sentiment", { params: { asset, range } }).then((res) => res.data);

export const fetchTrend = (asset, range) =>
  api.get("/sentiment/trend", { params: { asset, range } }).then((res) => res.data);

export const fetchCorrelation = (asset, range) =>
  api.get("/correlation", { params: { asset, range } }).then((res) => res.data);

export const fetchAssets = () => api.get("/assets").then((res) => res.data.assets);

export default api;
