// Build API and image URLs consistently across local and deployed environments.

// Production uses the browser's current origin because Express serves both the
// API and the compiled client. Local split-server development can override it.
export const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}
