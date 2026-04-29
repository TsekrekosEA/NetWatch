import axios from "axios";

export const API_URL = import.meta.env.PROD
  ? "/api"
  : (import.meta.env.VITE_API_URL ?? "http://localhost:8001");

export const client = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
});
