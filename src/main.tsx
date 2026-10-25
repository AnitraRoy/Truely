import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { SessionProvider } from "./lib/sessions/react";
import { getSessionController } from "./state/appController";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SessionProvider controller={getSessionController()}>
      <App />
    </SessionProvider>
  </React.StrictMode>
);