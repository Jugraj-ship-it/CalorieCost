const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL?.trim().replace(/\/+$/, "");

export const API = configuredBackendUrl ? `${configuredBackendUrl}/api` : "/api";
