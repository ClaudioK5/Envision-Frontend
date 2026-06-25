import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { getGoogleWebClientId } from "./auth/apiConfig";
import { AuthProvider } from "./auth/AuthProvider";
import { ToastProvider } from "./context/ToastContext";
import App from "./App";
import "./index.css";

const googleClientId = getGoogleWebClientId() ?? "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);
