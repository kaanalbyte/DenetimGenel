import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Dynamically determine the backend API URL
const getApiBaseUrl = (): string => {
  const hostname = window.location.hostname;
  // If running locally, or on our container preview, keep relative path
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".run.app")) {
    return "";
  }
  
  // Otherwise, default to the production preview deployment
  const savedUrl = localStorage.getItem("BACKEND_API_URL");
  if (savedUrl) {
    return savedUrl.replace(/\/$/, ""); // strip trailing slash if any
  }
  
  return "https://ais-pre-bfaall2bxd46msnkfxpvpc-98433837336.europe-west2.run.app";
};

// Global Fetch Interceptor to rewrite relative API requests
const originalFetch = window.fetch;
window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
  let finalInput = input;
  if (typeof input === "string" && input.startsWith("/api/")) {
    const apiBaseUrl = getApiBaseUrl();
    if (apiBaseUrl) {
      finalInput = `${apiBaseUrl}${input}`;
    }
  }
  return originalFetch(finalInput, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
