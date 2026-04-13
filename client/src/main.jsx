import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CreditProvider } from "./context/CreditContext";
import App from "./App";
import "./index.css";
import "./posthog";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CreditProvider>
          <App />
        </CreditProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
