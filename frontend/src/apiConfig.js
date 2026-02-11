const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  // Fallback to the current hostname but port 4000
  const hostname = window.location.hostname;
  return `http://${hostname}:4000`;
};

export const API_URL = getBackendUrl();
